use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentOdRecord {
    pub sl_no: u32,
    pub od_type: String,
    pub reason: String,
    pub basis: String,
    pub date: String,
    pub time: String,
    pub remarks: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentOdDetails {
    pub total_count: u32,
    pub records: Vec<StudentOdRecord>,
    pub semester_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OdResponse {
    pub success: bool,
    pub data: Option<StudentOdDetails>,
    pub error: Option<String>,
}
