use calamine::DataType;
#[derive(Debug,PartialEq,Eq,Ord)]
pub struct Record{
	id:i32,
	name:String,
	record:[i32;5],
	sum:i32,
	dongling:bool,
}
impl Record{
	pub const MAXIMUM:[i32;5]=[10,5,5,5,5];
	pub fn new()->Self{
		Self{
			id:0,
			name:String::new(),
			record:[0;5],
			sum:0,
			dongling:false,
		}
	}
	pub fn from(id:i32,name:String,record:[i32;5],dongling:bool)->Self{
		Self{
			id,
			name,
			record,
			sum:record.iter().sum(),
			dongling,
		}
	}
	pub fn from_row(row:&[calamine::Data])->Self{
		let id:i32=row[0].as_string().unwrap().parse::<i32>().expect("Unable to parse id");
		let name:String=row[1].get_string().unwrap().to_string();
		let mut record:[i32;5]=[0;5];
		for i in 0..5{
			record[i]=row[i+2].as_i64().expect("Unable to convert to int").try_into().unwrap();
		}
		let dongling=row[8].get_string()==Some("是");
		Self{
			id,
			name,
			record,
			sum:record.iter().sum(),
			dongling,
		}
	}
	pub fn name(&self)->&String{
		&self.name
	}
	pub fn sum(&self)->i32{
		self.sum
	}
	pub fn sum_prefix(&self,n:usize)->i32{
		self.record.iter().take(n+1).sum()
	}
	pub fn dongling(&self)->bool{
		self.dongling
	}
}
impl PartialOrd<Record> for Record{
	fn partial_cmp(&self,other:&Self)->Option<std::cmp::Ordering>{
		if self.sum>other.sum{
			Some(std::cmp::Ordering::Less)
		}else if self.sum<other.sum{
			Some(std::cmp::Ordering::Greater)
		}else if self.id<other.id{
			Some(std::cmp::Ordering::Less)
		}else if self.id>other.id{
			Some(std::cmp::Ordering::Greater)
		}else{
			Some(std::cmp::Ordering::Equal)
		}
	}
}
#[cfg(test)]
mod tests{
	use crate::record;
	use calamine::{Reader,DataType};
	#[test]
	fn open_and_read(){
		let mut workbook:calamine::Xls<_>=calamine::open_workbook("./sample.xls").expect("Cannot open sample.xls");
		let data=workbook.worksheet_range("10峰排行榜").expect("Cannot find sheet `10峰排行榜`");
		assert_eq!(data.start(),Some((0,0)));
		assert_eq!(data.end(),Some((15,16)));
		assert_eq!(data[(2,0)].get_int(),Some(1));
		assert_eq!(data[(3,1)].get_string(),Some("乙"));
		assert_eq!(data[(6,10)].as_i64(),Some(1));
		assert_eq!(data[(7,11)].as_i64(),Some(0));
		assert_eq!(data[(8,12)].as_i64(),Some(4));
		assert_eq!(data[(9,13)].as_i64(),Some(0));
		assert_eq!(data[(10,14)].as_i64(),Some(2));
		assert_eq!(data[(11,16)].get_string(),Some("是"));
		assert_eq!(data[(12,1)].get_string(),Some("123456789"));
		assert_eq!(data[(13,1)].get_string(),Some("2025-01-01"));
		assert_eq!(data[(14,1)].get_string(),Some("1.2"));
		assert_eq!(data[(15,1)].get_string(),Some("false"));
	}
	#[test]
	fn parse_record(){
		let mut workbook:calamine::Xls<_>=calamine::open_workbook("./sample.xls").expect("Cannot open sample.xls");
		let data=workbook.worksheet_range("10峰排行榜").expect("Cannot find sheet `10峰排行榜`");
		let data:calamine::Range<calamine::Data>=data.range((2,0),data.end().unwrap());
		let mut data=data.rows();
		assert_eq!(
			record::Record::from_row(data.nth(5).unwrap()),
			record::Record::from(6,"己".to_string(),[2,0,5,0,1],true)
		);
		assert_eq!(
			record::Record::from_row(data.nth(5).unwrap()),
			record::Record::from(12,"2025-01-01".to_string(),[0,0,0,0,0],false)
		);
	}
	#[test]
	fn compare_diff_sum(){
		let lhs=record::Record::from(1,"1".to_string(),[0,1,0,1,0],true);
		let rhs=record::Record::from(2,"2".to_string(),[1,0,1,0,1],false);
		assert!(lhs>rhs);
	}
	#[test]
	fn compare_same_sum(){
		let lhs=record::Record::from(1,"1".to_string(),[1,1,1,1,1],true);
		let rhs=record::Record::from(2,"2".to_string(),[1,1,1,1,1],false);
		assert!(lhs<rhs);
	}
}
