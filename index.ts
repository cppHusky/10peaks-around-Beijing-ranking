import {readFile} from "./utils/read-file";
import * as XLSX from "xlsx/xlsx.mjs";
let data=null;
let title=null;
document.getElementById("file").addEventListener("change",(event)=>{
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
});
