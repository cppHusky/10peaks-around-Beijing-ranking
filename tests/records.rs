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
