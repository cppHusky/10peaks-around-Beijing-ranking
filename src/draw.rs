use crate::record;
use plotters::prelude::*;
use plotters::style::text_anchor;
pub fn draw(records:&Vec<record::Record>)->Result<(),Box<dyn std::error::Error>>{
	let root=BitMapBackend::new("export.png",(3156,(800+records.len()*100).try_into().unwrap())).into_drawing_area();
	root.fill(&WHITE)?;
	root.draw(&Text::new(
		"徒步强国第三届京畿十峰挑战赛排行榜（第04周）",
		(500,100),
		("Noto Sans CJK SC",108.0).into_font()
	));
	let mut ypos=0;
	let mut last_sum=record::Record::MAXIMUM.iter().sum::<i32>()+1;
	for r in records{
		//if r.sum()==0{
		//	continue;
		//}
		if r.sum()!=last_sum{
			last_sum=r.sum();
			root.draw(&Text::new(
				r.sum().to_string(),
				(550+r.sum()*200,600+ypos),
				TextStyle::from(("Noto Sans CJK Sc",108.0,FontStyle::Bold).into_font()).pos(text_anchor::Pos::new(text_anchor::HPos::Left,text_anchor::VPos::Center)),
			));
		}
		root.draw(&Text::new(
			r.name().as_str(),
			(450,600+ypos),
			TextStyle::from(("Noto Sans CJK SC",80.0).into_font()).pos(text_anchor::Pos::new(text_anchor::HPos::Right,text_anchor::VPos::Center)),
		));
		root.draw(&Rectangle::new(
			[(500,570+ypos),(500+r.sum()*200,630+ypos)],
			Into::<ShapeStyle>::into(&CYAN).filled(),
		));
		root.draw(&Rectangle::new(
			[(500,570+ypos),(500+r.sum_prefix(4)*200,630+ypos)],
			Into::<ShapeStyle>::into(&RED).filled(),
		));
		root.draw(&Rectangle::new(
			[(500,570+ypos),(500+r.sum_prefix(3)*200,630+ypos)],
			Into::<ShapeStyle>::into(&BLUE).filled(),
		));
		root.draw(&Rectangle::new(
			[(500,570+ypos),(500+r.sum_prefix(2)*200,630+ypos)],
			Into::<ShapeStyle>::into(&MAGENTA).filled(),
		));
		root.draw(&Rectangle::new(
			[(500,570+ypos),(500+r.sum_prefix(1)*200,630+ypos)],
			Into::<ShapeStyle>::into(&GREEN).filled(),
		));
		if r.dongling(){
			root.draw(&Circle::new(
				(600,600+ypos),
				20,
				Into::<ShapeStyle>::into(&BLACK).filled(),
			));
		}
		ypos+=100;
	}
	Ok(())
}
