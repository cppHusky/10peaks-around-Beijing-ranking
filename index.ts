import {readFile} from "./utils/read-file";
import {drawWhole} from "./utils/graphing";
import * as XLSX from "xlsx/xlsx.mjs";
import {saveSvgAsPng} from "save-svg-as-png";
import {compare} from "./utils/compare";
export type Piece={
  "序号":number,
  "昵称":string,
  "太行之巅":number,
  "燕山天路":number,
  "京西龙脊":number,
  "军都龙脉":number,
  "坝上风云":number,
  "东灵完成":"是"|"否",
}
let pieces:Piece[]=undefined;
class Data{
  name:string;
  cumulates:number[];
  dongling:boolean;
  constructor(piece:Piece){
    this.name=piece["昵称"];
    this.dongling=piece["东灵完成"]==="是"?true:false;
    this.cumulates=[
      piece["太行之巅"],
      piece["燕山天路"],
      piece["京西龙脊"],
      piece["军都龙脉"],
      piece["坝上风云"]
    ].map((sum=>value=>sum+=value)(0));
  }
}
let data:Data[]=[];
let title=null;
document.getElementById("file").addEventListener("change",fileChangeListener);
function fileChangeListener(event){
  const target=event.target as HTMLInputElement;
  const file=target.files[0];
  if(!file){
    alert("请选择文件！");
    return;
  }
  readFile(target.files[0]).then((content)=>{
    const blob:ArrayBuffer=content;
    const workbook=XLSX.read(blob);
    const sheet=workbook.Sheets["10峰排行榜"];
    pieces=XLSX.utils.sheet_to_json(sheet);
    for(const piece of pieces){
      data.push(new Data(piece));
    }
    data.sort(compare);
  });
  document.getElementById("title-trigger").innerHTML=`
    <hr/>
    <input type="text" id="title" placeholder="请输入标题"></input>
    <button id="confirm">确认</button>
  `;
  document.getElementById("confirm").addEventListener("click",titleConfirmListener);
}
function titleConfirmListener(event){
  title=(document.getElementById("title") as HTMLInputElement).value;
  if(!data){
    alert("请选择文件！");
    return;
  }
  if(!title){
    alert("请输入标题！");
    return;
  }
  document.getElementById("download-trigger").innerHTML=`
    <hr/>
    <button id="download">下载此图片 (png)</button>
  `;
  drawWhole(data,title);
  document.getElementById("download").addEventListener("click",downloadClickListener);
}
function downloadClickListener(event){
  saveSvgAsPng(document.getElementById("graph-container").firstChild,"export.png");
}
