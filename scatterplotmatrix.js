// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/splom
 
// This version has been modified from the
// original -- these changes fall under 
// usage of this repo's license
function ScatterplotMatrix(data, {
  columns = data.columns, // array of column names, or accessor functions
  domain = undefined, // array of [lo,hi] ranges for each of ^^
  x = columns, // array of x-accessors
  y = columns, // array of y-accessors
  z = () => 1, // given d in data, returns the (categorical) z-value
  xDomain = domain, // array of ranges
  yDomain = domain, // array of ranges
  padding = 20, // separation between adjacent cells, in pixels
  dataPadding = 5, // separation between cell start and data points
  marginTop = 10, // top margin, in pixels
  marginRight = 20, // right margin, in pixels
  marginBottom = 30, // bottom margin, in pixels
  marginLeft = 40, // left margin, in pixels
  width = 928, // outer width, in pixels
  height = width, // outer height, in pixels
  xType = d3.scaleLinear, // the x-scale type
  yType = d3.scaleLinear, // the y-scale type
  zDomain, // array of z-values
  fillOpacity = 0.7, // opacity of the dots
  colors = d3.schemeCategory10, // array of colors for z
} = {}) {
  // Compute values (and promote column names to accessors).
  const X = d3.map(x, x => d3.map(data, typeof x === "function" ? x : d => d[x]));
  const Y = d3.map(y, y => d3.map(data, typeof y === "function" ? y : d => d[y]));
  const Z = d3.map(data, z);

  // Compute default z-domain, and unique the z-domain.
  if (zDomain === undefined) zDomain = Z;
  zDomain = new d3.InternSet(zDomain);

  // Omit any data not present in the z-domain.
  const I = d3.range(Z.length).filter(i => zDomain.has(Z[i]));

  // Compute the inner dimensions of the cells.
  const cellWidth = (width - marginLeft - marginRight - (X.length - 1) * padding) / X.length;
  const cellHeight = (height - marginTop - marginBottom - (Y.length - 1) * padding) / Y.length;

  // Construct scales and axes.
  const xScales = xDomain 
    ? X.map((_, i) => xType(xDomain[i], [0+dataPadding, cellWidth-dataPadding]))
    : X.map(X => xType(d3.extent(X), [0+dataPadding, cellWidth-dataPadding]));
  const yScales = yDomain
    ? Y.map((_, i) => yType(yDomain[i], [cellHeight-dataPadding, 0+dataPadding]))
    : Y.map(Y => yType(d3.extent(Y), [cellHeight-dataPadding, 0+dataPadding]));
  const zScale = d3.scaleOrdinal(zDomain, colors);
  const xAxis = d3.axisBottom().ticks(cellWidth / 50);
  const yAxis = d3.axisLeft().ticks(cellHeight / 35);

  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-marginLeft, -marginTop, width, height])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  svg.append("g")
    .selectAll("g")
    .data(yScales)
    .join("g")
    .attr("transform", (d, i) => `translate(0,${i * (cellHeight + padding)})`)
    .each(function (yScale) { return d3.select(this).call(yAxis.scale(yScale)); })
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").clone()
      .attr("x2", width - marginLeft - marginRight)
      .attr("stroke-opacity", 0.1));

  svg.append("g")
    .selectAll("g")
    .data(xScales)
    .join("g")
    .attr("transform", (d, i) => `translate(${i * (cellWidth + padding)},${height - marginBottom - marginTop})`)
    .each(function (xScale) { return d3.select(this).call(xAxis.scale(xScale)); })
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").clone()
      .attr("y2", -height + marginTop + marginBottom)
      .attr("stroke-opacity", 0.1))

  
  const cell = svg.append("g")
    .selectAll("g")
    .data(d3.cross(d3.range(X.length), d3.range(Y.length)))
    .join("g")
    .attr("fill-opacity", fillOpacity)
    .attr("transform", ([i, j]) => `translate(${i * (cellWidth + padding)},${j * (cellHeight + padding)})`);

  cell.append("rect")
    .attr("fill", "none")
    .attr("stroke", "currentColor")
    .attr("width", cellWidth)
    .attr("height", cellHeight);

  cell.each(function ([x, y]) {
    if (x == y && columns) {
      // TODO: somehow remap density to scale
      // TODO: split density plot based on Z values
      const kde = kernelDensityEstimator(kernelEpanechnikov(7), xScales[x].ticks(20))
      const density =  kde(X[x])
      console.log(density)
      d3.select(this).append("path")
        .attr("class", "mypath")
        .datum(density)
        .attr("fill", "#69b3a2")
        .attr("opacity", ".8")
        .attr("stroke", "#000")
        .attr("stroke-width", 1)
        .attr("stroke-linejoin", "round")
        .attr("d",  d3.line()
          .curve(d3.curveBasis)
          .x(d => xScales[x](d[0]))
          .y(d => yScales[y](d[1]))
        );

    } else {
      d3.select(this).selectAll("circle")
        .data(I.filter(i => !isNaN(X[x][i]) && !isNaN(Y[y][i])))
        .join("circle")
        .attr("r", 3.5)
        .attr("cx", i => xScales[x](X[x][i]))
        .attr("cy", i => yScales[y](Y[y][i]))
        .attr("fill", i => zScale(Z[i]));
    }
  });

  // TODO Support labeling for asymmetric sploms?
  if (x === y) svg.append("g")
    .attr("font-size", 10)
    .attr("font-family", "sans-serif")
    .attr("font-weight", "bold")
    .selectAll("text")
    .data(x)
    .join("text")
    .attr("transform", (d, i) => `translate(${i * (cellWidth + padding)},${i * (cellHeight + padding)})`)
    .attr("x", padding / 2)
    .attr("y", padding / 2)
    .attr("dy", ".71em")
    .text(d => d);

  return Object.assign(svg.node(), { scales: { color: zScale } });
}


// Function to compute density, from 
// https://d3-graph-gallery.com/graph/density_basic.html
function kernelDensityEstimator(kernel, X) {
  return function(V) {
    let v = X.map(function(x) {
      return [x, 2500 * d3.mean(V, v => kernel(x - v))]
    })
    v.push([v[v.length-1][0], 0])
    return v
  };
}
function kernelEpanechnikov(k) {
  return function(v) {
    return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0
  }
}
