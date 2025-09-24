import * as d3 from "d3";
import {Data} from "../index";
const colors=["#ea5545","#ef9b20","#bdcf32","#27aeef","#b33dc6"];
const width=3356;//width of whole picture
const headingHeight=650;//height of title and caption
const pieceLeft=856;//horizontal position of piece starts
const pieceRight=3000;//horizontal position of piece ends
const pieceHeight=60;//height of each piece
const pieceSep=40;//gap between pieces
export function drawWhole(data:Data[],title:string){
  const maxCount=data[0].cumulates.at(-1);
  const unitLen=(pieceRight-pieceLeft)/maxCount;
  const height=headingHeight+data.length*(pieceHeight+pieceSep)+50;
  d3.select("#graph-container")
    .selectAll("*")
    .remove();
  const svg=d3.select("#graph-container")
    .attr("width",width)
    .attr("height",height);
  svg.append("rect")
    .attr("width","100%")
    .attr("height","100%")
    .attr("fill","white");
  drawCaptions(svg,title);
  drawGridlines(svg,unitLen,height,maxCount);
  drawRecords(svg,data,unitLen);
  d3.selectAll("text")
    .style("font-family","sans");
}
const drawCaptions=(svg,title:string)=>{
  svg.append("text")
    .attr("x",pieceLeft)
    .attr("y",100)
    .style("font-size","108px")
    .text(title);
  svg.append("text")
    .attr("x",pieceLeft/2)
    .attr("y",350)
    .style("font-size","80px")
    .text("图例");
  svg.append("text")
    .attr("x",pieceLeft*0.95+pieceRight*0.05)
    .attr("y",300)
    .style("font-size","80px")
    .style("text-anchor","middle")
    .text("★");
  svg.append("text")
    .attr("x",pieceLeft*0.95+pieceRight*0.05)
    .attr("y",400)
    .style("font-size","80px")
    .style("text-anchor","middle")
    .text("东灵完成");
  const makeBlock=(caption,posRate,color)=>{
    svg.append("rect")
      .attr("x",pieceLeft*(1-posRate)+pieceRight*posRate)
      .attr("y",300-pieceHeight)
      .attr("width",pieceHeight)
      .attr("height",pieceHeight)
      .style("fill",color);
    svg.append("text")
      .attr("x",pieceLeft*(1-posRate)+pieceRight*posRate)
      .attr("y",400)
      .style("fill",color)
      .style("font-size","80px")
      .style("text-anchor","middle")
      .text(caption);
  };
  makeBlock("太行之巅",0.2,colors[0]);
  makeBlock("燕山天路",0.35,colors[1]);
  makeBlock("京西龙脊",0.5,colors[2]);
  makeBlock("军都龙脉",0.65,colors[3]);
  makeBlock("坝上风云",0.8,colors[4]);
  svg.append("text")
    .attr("x",pieceLeft*0.05+pieceRight*0.95)
    .attr("y",300)
    .style("font-size","80px")
    .style("text-anchor","middle")
    .text("✓");
  svg.append("text")
    .attr("x",pieceLeft*0.05+pieceRight*0.95)
    .attr("y",400)
    .style("font-size","80px")
    .style("text-anchor","middle")
    .text("支线完成");
}
const drawGridlines=(svg,unitLen:number,height:number,maxCount:number)=>{
  d3.select("head")
    .append("style")
    .text(`
      .solid{
        stroke:solid;
        stroke-width:3;
      }
      .dashed{
        stroke-dasharray:3 5;
        stroke-width:3;
      }
    `);
  svg.append("line")
    .attr("class","solid")
    .attr("x1",pieceLeft-2)
    .attr("y1",headingHeight-pieceHeight)
    .attr("x2",pieceLeft-2)
    .attr("y2",height-pieceHeight)
    .attr("stroke","black");
  for(let i=1;i <maxCount+1;i++){
    const x=pieceLeft+unitLen*i;
    svg.append("line")
      .attr("class",(d)=>{
        if(i%5===0){
          return "solid";
        }else{
          return "dashed";
        }
      })
      .attr("x1",x)
      .attr("y1",headingHeight-pieceHeight)
      .attr("x2",x)
      .attr("y2",height-pieceHeight)
      .attr("stroke","black");
    svg.append("text")
      .attr("x",x)
      .attr("y",headingHeight-pieceHeight*1.5)
      .style("font-size","40px")
      .style("text-anchor","middle")
      .text(i.toString());
  }
}
const drawRecords=(svg,data:Data[],unitLen:number)=>{
  const draw=(yOffset:number,startCount:number,endCount:number,color:string,maxBranchCount:number)=>{
    if(endCount-startCount===0){
      return;
    }
    const startPos=pieceLeft+unitLen*startCount;
    const endPos=pieceLeft+unitLen*endCount-pieceHeight/2;
    const path=d3.path();
    path.moveTo(pieceLeft,yOffset);
    path.lineTo(endPos,yOffset);
    path.arc(endPos,yOffset+pieceHeight/2,pieceHeight/2,-Math.PI/2,Math.PI/2);
    path.lineTo(pieceLeft,yOffset+pieceHeight);
    path.closePath();
    svg.append("path")
      .attr("d",path.toString())
      .style("fill",color);
    if(endCount-startCount===maxBranchCount){
      svg.append("text")
        .attr("x",endPos+pieceHeight/2-unitLen/2)
        .attr("y",yOffset+pieceHeight*0.9)
        .style("font-size","60px")
        .style("text-anchor","middle")
        .style("font-weight","bold")
        .text("✓");
    }
  }
  for(const [i,record] of data.entries()){
    svg.append("text")
      .attr("x",pieceLeft-pieceHeight/2)
      .attr("y",headingHeight+i*(pieceHeight+pieceSep)+pieceHeight*0.9)
      .style("font-size","80px")
      .style("text-anchor","end")
      .text(record.name);
    const yOffset=headingHeight+i*(pieceHeight+pieceSep);
    draw(yOffset,record.cumulates[3],record.cumulates[4],colors[4],5);
    draw(yOffset,record.cumulates[2],record.cumulates[3],colors[3],5);
    draw(yOffset,record.cumulates[1],record.cumulates[2],colors[2],5);
    draw(yOffset,record.cumulates[0],record.cumulates[1],colors[1],5);
    draw(yOffset,0,record.cumulates[0],colors[0],10);
    if(record.dongling){
      svg.append("text")
        .attr("x",pieceLeft+unitLen/2)
        .attr("y",headingHeight+i*(pieceHeight+pieceSep)+pieceHeight*0.9)
        .style("font-size","60px")
        .style("text-anchor","middle")
        .text("★");
    }
    if(!data[i+1]||record.sum!==data[i+1].sum){
      svg.append("text")
        .attr("x",pieceLeft+unitLen*record.sum+pieceHeight/2)
        .attr("y",headingHeight+i*(pieceHeight+pieceSep)+pieceHeight*0.9)
        .style("font-size","96px")
        .style("text-anchor","begin")
        .style("font-weight","bold")
        .text(record.sum.toString());
    }
  }
}
