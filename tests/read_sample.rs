use calamine::{Reader,DataType};
#[test]
fn open_and_read(){
	let mut workbook:calamine::Xls<_>=calamine::open_workbook("./sample.xls").expect("Cannot open sample.xls");
	let data=workbook.worksheet_range("汇总名单").expect("Cannot find sheet `汇总名单`");
	assert_eq!(data.start(),Some((0,0)));
	assert_eq!(data.end(),Some((15,16)));
	assert_eq!(data[(2,0)].get_int(),Some(1));
	assert_eq!(data[(3,1)].get_string(),Some("乙"));
	assert_eq!(data[(6,10)].get_int(),Some(1));
	assert_eq!(data[(7,11)].get_int(),Some(0));
	assert_eq!(data[(8,12)].get_int(),Some(4));
	assert_eq!(data[(9,13)].get_int(),Some(0));
	assert_eq!(data[(10,14)].get_int(),Some(2));
	assert_eq!(data[(11,16)].get_string(),Some("是"));
	assert_eq!(data[(12,1)].get_string(),Some("123456789"));
	assert_eq!(data[(13,1)].get_string(),Some("2025-01-01"));
	assert_eq!(data[(14,1)].get_string(),Some("1.2"));
	assert_eq!(data[(15,1)].get_string(),Some("false"));
}
#[test]
fn parse_record(){
	let mut workbook:calamine::Xls<_>=calamine::open_workbook("./sample.xls").expect("Cannot open sample.xls");
	let data=workbook.worksheet_range("汇总名单").expect("Cannot find sheet `汇总名单`");
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
