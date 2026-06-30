// Data layer - talks to Supabase 'teams' and 'tasks' tables directly from
// the browser. This mirrors the logic that used to live in server.ts's
// Express routes (mapJsTaskToDb, mapJsTeamToDb, getFYForDate, seeding, etc.)
import { supabase } from './supabase-client.js';
import { INITIAL_TEAMS, INITIAL_TASKS } from './seed-data.js';

// --- FY calculation (same rule as server.ts getFYForDate) ---
export function getFYForDate(month, year) {
  const mLower = String(month).trim().toLowerCase();
  const isJanToMar = ['january', 'february', 'march'].includes(mLower);
  if (year === 2025) return 'FY 2025-26';
  if (year === 2026) return isJanToMar ? 'FY 2025-26' : 'FY 2026-27';
  if (year === 2027) return isJanToMar ? 'FY 2026-27' : 'Future Planned';
  return 'Future Planned';
}

// --- Mapping helpers (camelCase JS <-> snake_case DB columns) ---
function mapDbTaskToJs(task) {
  return {
    id: task.id,
    teamCode: task.team_code,
    teamName: task.team_name,
    member: task.member,
    title: task.title,
    description: task.description || '',
    month: task.month,
    year: Number(task.year),
    fy: task.fy,
    status: task.status,
    costSaved: Number(task.cost_saved) || 0,
    targetSaving: Number(task.target_saving) || 0,
    remarks: task.remarks || '',
    supportingDocName: task.supporting_doc_name || '',
    createdAt: task.created_at,
  };
}

function mapJsTaskToDb(task) {
  return {
    id: task.id,
    team_code: task.teamCode,
    team_name: task.teamName,
    member: task.member,
    title: task.title,
    description: task.description,
    month: task.month,
    year: task.year,
    fy: task.fy,
    status: task.status,
    cost_saved: task.costSaved,
    target_saving: task.targetSaving,
    remarks: task.remarks,
    supporting_doc_name: task.supportingDocName,
    created_at: task.createdAt,
  };
}

function mapDbTeamToJs(team) {
  return {
    code: team.code,
    name: team.name,
    module: team.module,
    leader: team.leader,
    fy25Expenses: Number(team.fy25_expenses) || 0,
    targetReduction: Number(team.target_reduction) || 0,
    costSaved25_26: Number(team.cost_saved_25_26) || 0,
    costSaved26_27: Number(team.cost_saved_26_27) || 0,
  };
}

function mapJsTeamToDb(team) {
  return {
    code: team.code,
    name: team.name,
    module: team.module,
    leader: team.leader,
    fy25_expenses: team.fy25Expenses,
    target_reduction: team.targetReduction,
    cost_saved_25_26: team.costSaved25_26,
    cost_saved_26_27: team.costSaved26_27,
  };
}

async function insertInChunks(table, rows, chunkSize = 50) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Failed to seed ${table}: ${error.message}`);
  }
}

// Seeds teams + historical tasks the first time the database is empty.
async function seedIfEmpty() {
  const { data: teamsData, error: teamsErr } = await supabase.from('teams').select('code');
  if (teamsErr) throw new Error(`Failed to query teams: ${teamsErr.message}`);

  if (!teamsData || teamsData.length === 0) {
    await insertInChunks('teams', INITIAL_TEAMS.map(mapJsTeamToDb));
    await insertInChunks('tasks', INITIAL_TASKS.map(mapJsTaskToDb));
  }
}

// Fetches all teams + tasks, seeding first if the database is empty.
export async function fetchAllData() {
  await seedIfEmpty();

  const { data: teamsData, error: teamsErr } = await supabase.from('teams').select('*');
  if (teamsErr) throw new Error(`Failed to load teams: ${teamsErr.message}`);

  const { data: tasksData, error: tasksErr } = await supabase.from('tasks').select('*');
  if (tasksErr) throw new Error(`Failed to load tasks: ${tasksErr.message}`);

  return {
    teams: (teamsData || []).map(mapDbTeamToJs),
    tasks: (tasksData || []).map(mapDbTaskToJs),
  };
}

// Create a new task.
export async function createTask(fields, teams) {
  const { teamCode, member, title, description, month, year, fy, status, costSaved, remarks, supportingDocName } = fields;
  if (!teamCode || !title || !status) {
    throw new Error('Missing required task fields.');
  }
  const team = teams.find((t) => t.code === teamCode);
  const newTask = {
    id: `task-${Date.now()}`,
    teamCode,
    teamName: team ? team.name : 'Unknown Team',
    member: member || 'Unassigned',
    title,
    description: description || '',
    month: month || 'January',
    year: Number(year) || 2026,
    fy: fy || 'FY 2025-26',
    status: status || 'In Progress',
    costSaved: Number(costSaved) || 0,
    targetSaving: Number(costSaved) || 0,
    remarks: remarks || '',
    supportingDocName: supportingDocName || '',
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase.from('tasks').insert(mapJsTaskToDb(newTask));
  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return newTask;
}

// Update an existing task.
export async function updateTask(id, updatedFields, existingTask) {
  const status = updatedFields.status !== undefined ? updatedFields.status : existingTask.status;
  const costSaved = updatedFields.costSaved !== undefined ? Number(updatedFields.costSaved) : existingTask.costSaved;

  const updatedTask = {
    ...existingTask,
    ...updatedFields,
    costSaved,
    status,
    year: updatedFields.year !== undefined ? Number(updatedFields.year) : existingTask.year,
    targetSaving: costSaved,
  };

  const { error } = await supabase.from('tasks').update(mapJsTaskToDb(updatedTask)).eq('id', id);
  if (error) throw new Error(`Failed to update task: ${error.message}`);
  return updatedTask;
}

// Delete a task.
export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}

// Bulk create tasks (CSV/Excel import).
export async function bulkCreateTasks(items, teams) {
  const importedTasks = [];
  for (const item of items) {
    const { teamCode, member, title, description, month, year, fy, status, costSaved, remarks, supportingDocName } = item;
    if (!teamCode || !title || !status) continue;
    const team = teams.find((t) => t.code === teamCode);
    importedTasks.push({
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      teamCode,
      teamName: team ? team.name : 'Unknown Team',
      member: member || 'Unassigned',
      title,
      description: description || '',
      month: month || 'January',
      year: Number(year) || 2026,
      fy: fy || 'FY 2025-26',
      status: status || 'In Progress',
      costSaved: Number(costSaved) || 0,
      targetSaving: Number(costSaved) || 0,
      remarks: remarks || '',
      supportingDocName: supportingDocName || '',
      createdAt: new Date().toISOString(),
    });
  }
  if (importedTasks.length > 0) {
    await insertInChunks('tasks', importedTasks.map(mapJsTaskToDb));
  }
  return importedTasks;
}

// Reset database to initial seed values.
export async function resetDatabase() {
  const { error: delTasksErr } = await supabase.from('tasks').delete().neq('id', 'placeholder');
  if (delTasksErr) throw new Error(`Failed to clear tasks: ${delTasksErr.message}`);
  const { error: delTeamsErr } = await supabase.from('teams').delete().neq('code', 'placeholder');
  if (delTeamsErr) throw new Error(`Failed to clear teams: ${delTeamsErr.message}`);

  await insertInChunks('teams', INITIAL_TEAMS.map(mapJsTeamToDb));
  await insertInChunks('tasks', INITIAL_TASKS.map(mapJsTaskToDb));
}
