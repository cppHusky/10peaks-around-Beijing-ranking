import {Data} from "../index";
export function compare(lhs:Data,rhs:Data):number{
  const sumLeft=lhs.cumulates.at(-1);
  const sumRight=rhs.cumulates.at(-1);
  if(sumLeft>sumRight){
    return -1;
  }else if(sumLeft <sumRight){
    return 1;
  }else{
    return 0;
  }
}
