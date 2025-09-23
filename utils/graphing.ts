import * as d3 from "d3";
export function draw(data,title){
  const svg=d3.select("#graph-container")
    .append("svg")
    .attr("width",800)
    .attr("height",600);
  console.log(svg);
}
