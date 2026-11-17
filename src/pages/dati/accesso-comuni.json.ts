import { territorialAccess } from '../../lib/access';
export const prerender = true;
export function GET() {
  return new Response(JSON.stringify(territorialAccess, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
