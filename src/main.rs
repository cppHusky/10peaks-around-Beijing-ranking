mod record;
mod draw;
use calamine::Reader;
fn main()->Result<(),Box<dyn std::error::Error>>{
	let start_time=chrono::Local::now();
	let file_path:String=std::env::args().nth(1).expect("The first arg is file_path that must be provided.");
	let title:String=std::env::args().nth(2).expect("The second arg is the title that must be provided.");
	let mut workbook:calamine::Xlsx<_>=calamine::open_workbook(&file_path).expect(&format!("Cannot open {}",&file_path));
	let data=workbook.worksheet_range("10峰排行榜").expect("Cannot find sheet `10峰排行榜`");
	let data:calamine::Range<calamine::Data>=data.range((1,0),data.end().unwrap());
	let mut records:Vec<record::Record>=Vec::with_capacity(data.rows().count());
	for r in data.rows(){
		let record=record::Record::from_row(r);
		if record.sum()>0{
			records.push(record::Record::from_row(r));
		}
	}
	records.sort();
	let _=draw::draw(&records,&title);
	let end_time=chrono::Local::now();
	let time_spent=end_time-start_time;
	println!("Finished generating in {} ms.",time_spent.num_milliseconds());
	Ok(())
}
