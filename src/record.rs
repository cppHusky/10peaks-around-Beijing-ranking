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
	const MAXIMUM:[i32;5]=[10,5,5,5,5];
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
		let id:i32=row[0].get_int().expect("Unable to convert to int").try_into().unwrap();
		let name:String=row[1].get_string().unwrap().to_string();
		let mut record:[i32;5]=[0;5];
		for i in 0..5{
			record[i]=row[i+10].get_int().expect("Unable to convert to int").try_into().unwrap();
		}
		let dongling=row[16].get_string()==Some("是");
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
