// Preloaded (node --import) into the snake tool for the phone board: the tool reads the whole
// year, and this keeps only the last SNAKE_WEEKS weeks of the calendar it receives, so the board
// has cells of a readable size in a phone column. Nothing else in the response changes.
const WEEKS = Number(process.env.SNAKE_WEEKS);
if (!Number.isInteger(WEEKS) || WEEKS < 4 || WEEKS > 53) throw new Error('SNAKE_WEEKS must be a whole number of weeks (4-53)');

const upstream = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const response = await upstream(input, init);
  const url = typeof input === 'string' ? input : input.url;
  if (!url.endsWith('/graphql') || !response.ok) return response;
  const body = await response.json();
  const calendar = body?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!Array.isArray(calendar?.weeks) || calendar.weeks.length < WEEKS) throw new Error('Contribution calendar not found in the response');
  calendar.weeks = calendar.weeks.slice(-WEEKS);
  return new Response(JSON.stringify(body), { status: response.status, headers: { 'content-type': 'application/json' } });
};
