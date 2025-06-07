use crate::record;
use plotters::prelude::*;
use plotters::style::text_anchor;
use plotters::element::DashedPathElement;
const COLORS:[RGBColor;5]=[
	RGBColor(0xea,0x55,0x45),
	RGBColor(0xef,0x9b,0x20),
	RGBColor(0xbd,0xcf,0x32),
	RGBColor(0x27,0xae,0xef),
	RGBColor(0xb3,0x3d,0xc6),
];
const WIDTH:i32=3156;
const HEADING_HEIGHT:i32=600;
const PIECE_LEFT:i32=656;
const PIECE_RIGHT:i32=2800;
const PIECE_HEIGHT:i32=60;
const PIECE_SEP:i32=40;
pub fn draw(records:&Vec<record::Record>,title:&String)->Result<(),Box<dyn std::error::Error>>{
	let max_count:i32=records[0].sum();
	let unit_len:i32=(PIECE_RIGHT-PIECE_LEFT)/max_count;
	let height:i32=(HEADING_HEIGHT+(records.len() as i32)*(PIECE_HEIGHT+PIECE_SEP));
	let root=BitMapBackend::new(
		"export.png",
		(WIDTH as u32,height as u32),
	).into_drawing_area();
	root.fill(&WHITE)?;
	draw_captions(&root,title.clone());
	draw_gridlines(&root,unit_len,height,max_count);
	draw_records(&root,&records,unit_len);
	Ok(())
}
fn draw_captions(root:&DrawingArea<BitMapBackend,plotters::coord::Shift>,title:String){
	let _=root.draw(&Text::new(
		title,
		(PIECE_LEFT,100),
		("Noto Sans CJK SC",108.).into_font()
	));
	let text_style=TextStyle::from(("Noto Sans CJK SC",80.).into_font()).pos(text_anchor::Pos::new(text_anchor::HPos::Center,text_anchor::VPos::Center));
	let _=root.draw(&Text::new(
		"图例",
		(PIECE_LEFT/2,350),
		TextStyle::from(("Noto Sans CJK SC",80.,FontStyle::Bold).into_font()).pos(text_anchor::Pos::new(text_anchor::HPos::Left,text_anchor::VPos::Center)),
	));
	let _=root.draw(&Circle::new(
		(PIECE_LEFT+60,300),
		PIECE_HEIGHT/3,
		Into::<ShapeStyle>::into(&BLACK).filled(),
	));
	let _=root.draw(&Text::new(
		"东灵",
		(PIECE_LEFT+60,400),
		&text_style,
	));
	let block=|name:&str,pos_rate:f64,color_id:usize|{
		let _=root.draw(&Rectangle::new(
			[(((PIECE_LEFT as f64)*(1.-pos_rate)+(PIECE_RIGHT as f64)*pos_rate) as i32-PIECE_HEIGHT/2,300-PIECE_HEIGHT/2),(((PIECE_LEFT as f64)*(1.-pos_rate)+(PIECE_RIGHT as f64)*pos_rate) as i32+PIECE_HEIGHT/2,300+PIECE_HEIGHT/2)],
			COLORS[color_id].filled(),
		));
		let _=root.draw(&Text::new(
			name,
			(((PIECE_LEFT as f64)*(1.-pos_rate)+(PIECE_RIGHT as f64)*pos_rate) as i32,400),
			text_style.clone().color(&COLORS[color_id]),
		));
	};
	block("太行之巅",0.2,0);
	block("京西龙脊",0.4,1);
	block("军都龙脉",0.6,2);
	block("燕山天路",0.8,3);
	block("坝上风云",1.0,4);
}
fn draw_records(root:&DrawingArea<BitMapBackend,plotters::coord::Shift>,records:&Vec<record::Record>,unit_len:i32){
	let mut y_offset=0;
	let mut last_sum=record::Record::MAXIMUM.iter().sum::<i32>()+1;
	for r in records{
		//if r.sum()==0{
		//	continue;
		//}
		if r.sum()!=last_sum && r.sum()>0{
			last_sum=r.sum();
			let _=root.draw(&Text::new(
				r.sum().to_string(),
				(PIECE_LEFT+r.sum()*unit_len+50,HEADING_HEIGHT+y_offset),
				TextStyle::from(("Noto Sans CJK Sc",108.0,FontStyle::Bold).into_font()).pos(text_anchor::Pos::new(text_anchor::HPos::Left,text_anchor::VPos::Center)),
			));
		}
		let draw_pieces=|end_pos:i32,color_id:usize|{
			let _=root.draw(&Rectangle::new(
				[(PIECE_LEFT,HEADING_HEIGHT-PIECE_HEIGHT/2+y_offset),(PIECE_LEFT+end_pos*unit_len,HEADING_HEIGHT+PIECE_HEIGHT/2+y_offset)],
				COLORS[color_id].filled(),
			));
		};
		draw_pieces(r.sum(),4);
		draw_pieces(r.sum_prefix(3),3);
		draw_pieces(r.sum_prefix(2),2);
		draw_pieces(r.sum_prefix(1),1);
		draw_pieces(r.sum_prefix(0),0);
		if r.dongling(){
			let _=root.draw(&Circle::new(
				(PIECE_LEFT+unit_len/2,HEADING_HEIGHT+y_offset),
				PIECE_HEIGHT/3,
				Into::<ShapeStyle>::into(&BLACK).filled(),
			));
		}
		let pos=text_anchor::Pos::new(text_anchor::HPos::Right,text_anchor::VPos::Center);
		let _=root.draw(&Text::new(
			r.name().as_str(),
			(PIECE_LEFT-50,HEADING_HEIGHT+y_offset),
			TextStyle::from(("Noto Sans CJK SC",80.0).into_font()).pos(pos),
		));
		y_offset+=PIECE_HEIGHT+PIECE_SEP;
	}
}
fn draw_gridlines(root:&DrawingArea<BitMapBackend,plotters::coord::Shift>,unit_len:i32,height:i32,max_count:i32){
	let _=root.draw(&PathElement::new(
		[(PIECE_LEFT-4,HEADING_HEIGHT-PIECE_HEIGHT),(PIECE_LEFT-4,height-PIECE_HEIGHT)],
		ShapeStyle::from(RGBColor(0x00,0x00,0x00)).stroke_width(4),
	));
	for i in 1..max_count{
		if i%5==0{
			let _=root.draw(&PathElement::new(
				[(PIECE_LEFT+unit_len*i,HEADING_HEIGHT-PIECE_HEIGHT),(PIECE_LEFT+unit_len*i,height-PIECE_HEIGHT)],
				ShapeStyle::from(RGBColor(0x00,0x00,0x00)).stroke_width(4),
			));
		}else{
			let _=root.draw(&DashedPathElement::new(
				[(PIECE_LEFT+unit_len*i,HEADING_HEIGHT-PIECE_HEIGHT),(PIECE_LEFT+unit_len*i,height-PIECE_HEIGHT)],
				4,
				12,
				ShapeStyle::from(RGBColor(0x00,0x00,0x00)).stroke_width(4),
			));
		}
	}
}
