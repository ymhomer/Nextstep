import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Nextstep — Personal Planner',description:'A calmer way to organize projects, plan your day and keep track of follow-ups.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
