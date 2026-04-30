# Resources and Prompts

## Resources

- `whoop://capabilities`
- `whoop://latest/recovery`
- `whoop://latest/sleep`
- `whoop://latest/cycle`
- `whoop://summary/daily`
- `whoop://summary/weekly`

Resources return JSON and respect the configured privacy mode where applicable.

`whoop://capabilities` is static and does not call WHOOP. It is designed for agents that need to understand the project boundary, supported data, unsupported sensor streams, privacy modes and recommended tool order.

## Prompts

- `daily_performance_coach`
- `weekly_training_review`
- `sleep_recovery_investigator`

Prompts instruct the host model to call the summary tools and produce practical, non-medical performance guidance.
