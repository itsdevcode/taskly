use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
pub mod pages;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Pending,
    Completed,
}
impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Completed => "completed",
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: Status,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    pub description: String,
    pub due_date: Option<String>,
}
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum View {
    Pending,
    Upcoming,
    Completed,
}
impl Task {
    pub fn view(&self, today: NaiveDate) -> View {
        if self.status == Status::Completed {
            return View::Completed;
        }
        if self
            .due_date
            .as_deref()
            .is_some_and(|d| d > today.to_string().as_str())
        {
            View::Upcoming
        } else {
            View::Pending
        }
    }
    pub fn overdue(&self, today: NaiveDate) -> bool {
        self.status == Status::Pending
            && self
                .due_date
                .as_deref()
                .is_some_and(|d| d < today.to_string().as_str())
    }
}
