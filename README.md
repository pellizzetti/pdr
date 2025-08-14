# PDR (performance development review)

PDR are a PITA. This project is meant to help me in the process for gathering data and generating evaluations for a given performance development review cycle.

## Collecting data

### JIRA

1. **Run Jira export script**
   - Execute `scripts/jira-issues-export.ts` to retrieve tasks from Jira:
   ```
   bun run jira-issues-export.ts 2025-01-01 2025-08-10 --project KALI
   ```

2. **Run Jira compilation prompt**
   - Use the following prompt with the exported Jira tasks file:
```
You are an expert in processing Jira export data and creating performance cycle summaries.

I have Jira issues exported in two formats inside 1s2025/jira/:
  jira-issues.csv
  jira-issues.json

Both contain the same data — use whichever format you prefer.

The relevant fields are:
    key
    summary
    points
    status
    type
    assignee
    reporter
    priority
    created
    updated
    resolutiondate
    project
    url

Your task
    Read all Jira issues from the given file.
    For any issue where assignee is empty (Unassigned), set the assignee to "Guilherme Pellizzetti".
    Group tasks by assignee.
    Inside each assignee group:
      Group further by project (project field).
      Inside each project, group by type (Story, Bug, Task, Epic, etc.).

    For each task, include:
      Key (as a clickable link using url)
      Summary
      Points
      Status
      Priority
      Created date
      Updated date
      Resolution date (if present, otherwise "N/A")

    At the top of the output, generate a summary table per assignee:
      Total number of issues
      Total number of points
      Count per status
      Count per type
      Count per project

    Dates should be formatted as YYYY-MM-DD.
    Order tasks by created date (ascending) inside each group.

Output format

# Jira Issues Summary by Person

## Overview Table by Assignee
| Assignee | Total Issues | Total Points | Stories | Bugs | Tasks | In Progress | Done | To Do |
| -------- | ------------ | ------------ | ------- | ---- | ----- | ----------- | ---- | ----- |
| Guilherme Pellizzetti | 12 | 32 | 5 | 3 | 4 | 3 | 5 | 4 |
| John Doe | ... | ... | ... | ... | ... | ... | ... | ... |

## Assignee: Guilherme Pellizzetti
### Project: KALI
#### Stories
- [KALI-2769](https://...) — Configurar NGINX do IoT Hub para receber requests mal formatadas (Status: To Do, Priority: Medium, Created: 2025-08-08, Updated: 2025-08-08, Resolved: N/A)
#### Bugs
...

Important:
  Use Markdown headings and bullet points exactly as described.
  Do not omit any issue.
  Apply the “Unassigned → Guilherme Pellizzetti” rule before grouping.
  Do not fabricate any data that isn’t in the CSV/JSON.
```

### TeamRetro

3. **Download TeamRetro data**
   - Go to TeamRetro settings
   - Download the ZIP file containing all retros for the team
   - Place the ZIP file in the `<CYCLE>/teamretro/` folder filtering by <CYCLE> in the filename

4. **Run TeamRetro compilation script**
   - Execute `scripts/teamretro-compile.ts` to compile retro information for the cycle:
   ```
   bun run teamretro-compile.ts ./retros --name-contains kali-1s25 --out ./1s2025/teamretro --format md
   ```
   > [!WARNING]
   > This script should be reviewed and improved - I'll start tagging retro cards so it's easier to identify them during review preparation

### Slack

5. **Gather Slack summaries**
   - From relevant Slack channels and conversations, collect the AI-generated summaries

6. **Run Slack compilation prompt**
   - Use the following prompt with the collected Slack summaries:
```
You are an expert at analyzing conversation data and summarizing it by participant.

I have a folder named <CYCLE>/slack containing multiple text files.
Each file contains Slack messages from various channels and DMs, already compiled by Slack AI.
Messages may contain mentions in the form @username (e.g., @Pellizzetti).

Your task:
    Read all files in the <CYCLE>/slack folder.
    Identify all messages where a user is mentioned (@username).
    Group messages by mentioned username.

    For each mentioned user:
        Provide a concise but detailed summary of what was discussed involving them.
        Include relevant context (projects, decisions, problems discussed, actions taken).
        Avoid repeating exact text from the messages unless it’s important for clarity.
        If possible, categorize the discussions into themes (e.g., “Project updates”, “Technical issues”, “Decisions”, “Follow-ups”).

    At the end, output:
        A summary report for each mentioned user.
        A global index of all mentioned users with a short one-line description of their main involvement.

Output format:
    Markdown file
    Use ## @username headings for each user’s section.
    Under each heading, list bullet points grouped by theme.
    Include a top-level # Mentions Summary heading with the global index table.

Important:
    Treat mentions case-insensitively.
    Ignore system messages or bot messages unless they are directly relevant to the user mentioned.
    Do not fabricate content — only summarize from the actual messages.
```

### Projects docs & reports

7. **Assemble project documentation**
   - Create documents for all projects completed in the cycle
   - Place them in the corresponding `projects` folder (e.g., `<CYCLE>/projects`)

8. **Export Weekly Status Report (WSR)**
   - Export the WSR as a CSV file
   - Place `wsr.csv` in the cycle's projects folder

9. **Export satisfaction surveys**
   - Export satisfaction survey results as CSV
   - Add them to the cycle's projects folder

10. **Include cycle results document**
    - If available, place the cycle results document (usually containing metrics) in the projects folder

## Reviews

### Run evaluation prompts
  - For each required evaluation, run the appropriate prompt for that person's role and level - it could be useful to gather the carrer plan too.
  > [!IMPORTANT]
  > The evaluation format changes annually - always adapt the structure to match the current year's template.
  - Example - my own evaluation prompt for `1s2025`:
```
You are an expert in performance review writing.

I will provide you with multiple data sources containing information about my work during the first semester of 2025.
Your task is to analyze all provided sources and produce a self-performance review in Brazilian Portuguese, written in a slightly casual but still professional tone.
The output must be saved as a Markdown file with clear section headings matching the review form.

Data sources:
  Jira data: 1s2025/jira/jira-issues-summary.md
  Slack compilations: 1s2025/slack/slack-mentions-summary.md
  TeamRetro summaries: 1s2025/teamretro/teamretro-compilation.md
  Projects folder: 1s2025/projects/ (contains two .md files with author, docs, and release messages, plus a .csv satisfaction survey)
  Weekly Status Report: 1s2025/projects/wsr.csv (spreadsheet log tracking weekly progress on projects)

Important rules:
  If it is unclear who performed a certain action, gave an idea, or led an initiative, attribute it to Guilherme Pellizzetti.
  The project flink-state-manager.md is not owned by Guilherme Pellizzetti and should not be credited as such. He contributed significantly to the Node.js part only, but ownership belongs to Bruno Scholl.

Review Form Structure

You must fill the following sections with detailed content based on the data sources above.
Each section should have clear examples to support statements, avoiding generic answers.
Focus on connecting behaviors, actions, and results to Cobli’s Career Path expectations for my level.

1. Autonomia e tomada de decisão

Evaluate how I demonstrated autonomy and decision-making. Consider:
  Taking decisions with full responsibility, aligned with Cobli’s procedures.
  Actively supporting problem resolution and decision-making in other areas, aligned with Cobli’s strategies and goals.
  Identifying needs in the area and creating impactful action plans.
  Properly planning work considering objectives, resources, deadlines, and priorities.

Ratings: Insuficiente | Atende Parcialmente | Atende | Acima das Expectativas | Excepcional

2. Comunicação e colaboração

Evaluate my communication and collaboration. Consider:
    Communicating assertively in complex situations and mediating conflicts.
    Ensuring collaboration in complex projects, aligning all stakeholders.
    Giving constructive feedback and identifying development opportunities for peers and leadership.
    Participating in cross-team forums, contributing beyond my area.

Ratings: Insuficiente | Atende Parcialmente | Atende | Acima das Expectativas | Excepcional

3. Domínio técnico e execução

Evaluate my technical mastery and execution. Consider:
  Leading complex projects and processes, ensuring solution effectiveness and cross-area integration.
  Applying technical knowledge and strategic vision to lead innovations and solve critical problems.
  Facilitating adaptation to organizational and procedural changes.
  Proactively seeking new knowledge and solutions to improve professional growth and area projects.

Ratings: Insuficiente | Atende Parcialmente | Atende | Acima das Expectativas | Excepcional

4. Resultados

Evaluate the results delivered in the semester. Consider:
    Achievement of team goals and individual deliveries (projects, initiatives, responsibilities).
    Compare with the “team goals” spreadsheet (Mapping per person tab).
    If rating differs from team goal achievement, explain with data and justification.

Ratings: Insuficiente | Atende Parcialmente | Atende | Acima das Expectativas | Excepcional

5. Próximos passos

Based on results and behaviors, and the expected challenges for the next semester, define main development focuses.

Final instructions:
    Write the entire review in Brazilian Portuguese.
    Use a slightly casual tone, but still aligned with professional standards.
    Use Markdown headings matching the section titles above.
    Include concrete examples from the data sources in each section.
    Avoid overly generic statements; make it specific and impactful.
```

## Security

### Encrypting review data

After completing the review cycle, encrypt the sensitive folders containing personal data:

```bash
tar czf - cycles/<CYCLE>/ | gpg --symmetric --cipher-algo AES256 --output cycles/<CYCLE>.tar.gz.gpg

# Example
tar czf - cycles/1s2025/ | gpg --symmetric --cipher-algo AES256 --output cycles/1s2025.tar.gz.gpg
# Remove original unencrypted folders after verifying encryption worked
rm -rf cycles/1s2025/
```

**To decrypt when needed:**
```bash
gpg --decrypt <CYCLE>.tar.gz.gpg | tar xzf -
```

## Important Notes

- Ensure all data is compiled before running final evaluation prompts for best results (duh!).
