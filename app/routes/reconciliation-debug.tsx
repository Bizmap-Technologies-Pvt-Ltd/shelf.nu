import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Fetch directly from the API endpoint
    const bundlesResponse = await fetch(`${request.url.split('/reconciliation-debug')[0]}/api/reconciliation`, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      }
    });
    
    const responseData = await bundlesResponse.json();
    
    return json({
      apiResponse: responseData,
      responseStatus: bundlesResponse.status,
      responseOk: bundlesResponse.ok
    });
  } catch (error: any) {
    return json({
      error: error.message || "Unknown error occurred",
      stack: error.stack
    });
  }
}

export default function ReconciliationDebug() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div style={{ padding: "20px" }}>
      <h1>Reconciliation API Debug</h1>
      <div>
        <Link to="/reconciliation" style={{ color: "blue", textDecoration: "underline" }}>
          Back to Reconciliation
        </Link>
      </div>
      <hr />
      <div>
        <h2>API Response Status: {data.responseStatus} ({data.responseOk ? 'OK' : 'Error'})</h2>
        <h3>Response Data:</h3>
        <pre style={{ 
          background: "#f5f5f5", 
          padding: "15px", 
          border: "1px solid #ddd",
          borderRadius: "5px",
          overflowX: "auto" 
        }}>
          {JSON.stringify(data.apiResponse, null, 2)}
        </pre>
      </div>
    </div>
  );
}
