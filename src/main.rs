mod draw;
use calamine::{Reader,DataType};
fn main()->Result<(),Box<dyn std::error::Error>>{
	let file_path=std::env::args().nth(1).expect("The first arg is file_path that must be provided.");
	let title=std::env::args().nth(2).expect("The second arg is the title that must be provided.");
	let mut workbook:calamine::Xls<_>=calamine::open_workbook(&file_path).expect(&format!("Cannot open {}",&file_path));
	let data=workbook.worksheet_range("汇总名单").expect("Cannot find sheet `汇总名单`");
	let data:calamine::Range<calamine::Data>=data.range((2,1),data.end().unwrap());
	let mut records:Vec<ranking::Record>=Vec::with_capacity(data.rows().count());
	for r in data.rows(){
		records.push(ranking::Record::from_row(r));
	}
	Ok(())
}
