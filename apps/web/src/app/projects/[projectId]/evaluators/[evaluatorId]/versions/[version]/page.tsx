import { EvaluatorVersionDetailClient } from "./version-detail-client";
export default async function Page({params}:{params:Promise<{projectId:string;evaluatorId:string;version:string}>}){return <EvaluatorVersionDetailClient {...await params}/>;}
