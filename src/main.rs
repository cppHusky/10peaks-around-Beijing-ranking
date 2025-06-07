mod record;
mod draw;
use calamine::Reader;
fn main()->Result<(),Box<dyn std::error::Error>>{
	let file_path:String=std::env::args().nth(1).expect("The first arg is file_path that must be provided.");
	let title:String=std::env::args().nth(2).expect("The second arg is the title that must be provided.");
	let mut workbook:calamine::Xls<_>=calamine::open_workbook(&file_path).expect(&format!("Cannot open {}",&file_path));
	let data=workbook.worksheet_range("汇总名单").expect("Cannot find sheet `汇总名单`");
	let data:calamine::Range<calamine::Data>=data.range((2,0),data.end().unwrap());
	let mut records:Vec<record::Record>=Vec::with_capacity(data.rows().count());
	for r in data.rows(){
		records.push(record::Record::from_row(r));
	}
	records.sort();
	draw::draw(&records,&title)
}
