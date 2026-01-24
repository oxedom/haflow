Feature Request Identified
Workflow History Navigation: Ability to toggle through completed workflow steps and view their inputs/outputs in read-only mode
Core requirements extracted:
View completed steps (not just current)
Read-only presentation of historical data
Show both input files and output files for each step
Navigate/toggle between steps in history
Technical Context
This aligns with the existing architecture documented in CLAUDE.md:
Artifacts stored in ~/.haflow/missions/<id>/artifacts/
Each workflow step produces files (e.g., raw-input.md → structured-text.md)