use calamine::DataType;
#[derive(Debug,PartialEq,Eq)]
pub struct Record{
	name:String,
	record:[i32;5],
	sum:i32,
	dongling:bool,
}
impl Record{
	const MAXIMUM:[i32;5]=[10,5,5,5,5];
	pub fn new()->Self{
		Self{
			name:String::new(),
			record:[0;5],
			sum:0,
			dongling:false,
		}
	}
	pub fn from(name:String,record:[i32;5],dongling:bool)->Self{
		Self{
			name,
			record,
			sum:record.iter().sum(),
			dongling,
		}
	}
	pub fn from_row(row:&[calamine::Data])->Self{
		let name:String=row[0].get_string().unwrap().to_string();
		let mut record:[i32;5]=[0;5];
		for i in 0..5{
			record[i]=row[i+9].get_int().expect("Unable to convert to int").try_into().unwrap();
		}
		let dongling=row[15].get_string()==Some("是");
		Self{
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
