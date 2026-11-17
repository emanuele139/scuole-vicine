// Geographic anchors for a deliberately simplified, city-scale metro overlay.
// Network and line colors: https://www.atm.it/it/AltriServizi/Trasporto/Documents/schema_rete_metro.pdf
export const metroLines = [
  {name:'M1',color:'#e95657',branches:[[[9.087,45.518],[9.111,45.505],[9.127,45.497],[9.140,45.486],[9.156,45.480],[9.166,45.468],[9.179,45.468],[9.190,45.464],[9.202,45.466],[9.206,45.474],[9.211,45.480],[9.216,45.486],[9.225,45.496],[9.237,45.509],[9.244,45.521],[9.248,45.535]],[[9.111,45.455],[9.127,45.459],[9.138,45.464],[9.148,45.468],[9.156,45.480]]]},
  {name:'M2',color:'#5dbc82',branches:[[[9.168,45.410],[9.158,45.429],[9.168,45.443],[9.170,45.452],[9.169,45.462],[9.176,45.468],[9.168,45.477],[9.176,45.485],[9.187,45.484],[9.202,45.485],[9.211,45.484],[9.216,45.486],[9.225,45.485],[9.236,45.484],[9.234,45.491],[9.235,45.503],[9.248,45.505],[9.260,45.512],[9.260,45.519]],[[9.175,45.429],[9.171,45.437],[9.168,45.443]]]},
  {name:'M3',color:'#f2ce58',branches:[[[9.164,45.528],[9.170,45.522],[9.174,45.513],[9.179,45.505],[9.185,45.497],[9.193,45.492],[9.202,45.485],[9.197,45.480],[9.194,45.475],[9.193,45.470],[9.190,45.464],[9.188,45.461],[9.195,45.456],[9.202,45.452],[9.210,45.447],[9.219,45.440],[9.224,45.436],[9.230,45.433],[9.238,45.429],[9.256,45.430]]]},
  {name:'M4',color:'#638bef',branches:[[[9.122,45.442],[9.131,45.445],[9.140,45.446],[9.149,45.449],[9.158,45.453],[9.169,45.462],[9.176,45.458],[9.181,45.456],[9.188,45.458],[9.197,45.463],[9.202,45.466],[9.211,45.468],[9.216,45.468],[9.229,45.468],[9.239,45.464],[9.255,45.464],[9.272,45.461],[9.277,45.461]]]},
  {name:'M5',color:'#bb91d0',branches:[[[9.119,45.476],[9.129,45.476],[9.137,45.476],[9.145,45.478],[9.150,45.481],[9.156,45.481],[9.162,45.485],[9.169,45.488],[9.180,45.488],[9.187,45.484],[9.191,45.487],[9.193,45.492],[9.192,45.498],[9.196,45.505],[9.201,45.510],[9.205,45.515],[9.209,45.521],[9.213,45.526]]]},
];
export function project(lng:number,lat:number) {
  const col = (lng-9.035)/.0047, row = (45.54-lat)/.0033;
  return projectGrid(col,row);
}

/** Near-overhead projection; a small tilt keeps the relief readable. */
export function projectGrid(col:number,row:number,elevation=0) {
  return {x:80+col*10.5+row*1.1-elevation*.12,y:105+row*10.1-col*.6-elevation*.38};
}

/** Cubic Catmull–Rom interpolation keeps the schematic routes soft through their anchors. */
export function smoothPath(points: {x:number;y:number}[]): string {
  if (!points.length) return '';
  let path = `M${points[0].x},${points[0].y}`;
  for (let i=0; i<points.length-1; i++) {
    const before=points[Math.max(0,i-1)], start=points[i];
    const end=points[i+1], after=points[Math.min(points.length-1,i+2)];
    path += ` C${start.x+(end.x-before.x)/6},${start.y+(end.y-before.y)/6} ${end.x-(after.x-start.x)/6},${end.y-(after.y-start.y)/6} ${end.x},${end.y}`;
  }
  return path;
}
