import {readFile} from "./utils/read-file";
import {draw} from "./utils/graphing";
import * as XLSX from "xlsx/xlsx.mjs";
import {saveSvgAsPng} from "save-svg-as-png";
let data=null;
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
    data=XLSX.utils.sheet_to_json(sheet);
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
  draw(data,title);
  document.getElementById("download").addEventListener("click",downloadClickListener);
}
function downloadClickListener(event){
  saveSvgAsPng(document.getElementById("graph-container").firstChild,"export.png");
}
