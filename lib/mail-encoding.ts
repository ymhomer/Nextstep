// MSG's DataStream decoder runs in both browsers and Workers without Node Buffer.
// Unicode properties are decoded by DataStream itself. Legacy ANSI properties use
// the platform's WHATWG decoder; unsupported codepages fail explicitly.
export function decode(bytes:Uint8Array,encoding:string){const raw=encoding.toLowerCase().replace(/[_ ]/g,'-');const labels:Record<string,string>={utf8:'utf-8',utf16le:'utf-16le',ucs2:'utf-16le',cp932:'shift_jis',cp936:'gbk',cp949:'euc-kr',cp950:'big5'};const label=labels[raw]||raw.replace(/^cp(125[0-8])$/,'windows-$1');return new TextDecoder(label).decode(bytes)}
export function encode(text:string,encoding:string){if(!/^utf-?8$/i.test(encoding))throw Error('Unsupported MSG output encoding: '+encoding);return new TextEncoder().encode(text)}
