export async function readFile(file:File){
  return new Promise<ArrayBuffer>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=(event)=>{
      const {result}=reader;
      resolve(result as ArrayBuffer);
    };
    reader.onerror=reject;
    reader.readAsArrayBuffer(file);
  });
}
