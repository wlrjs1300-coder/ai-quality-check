import { EvaluatorDetailClient } from "./evaluator-detail-client";
export default async function Page({params}:{params:Promise<{projectId:string;evaluatorId:string}>}){return <EvaluatorDetailClient {...await params}/>;}
