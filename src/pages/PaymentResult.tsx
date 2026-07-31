import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Public, unauthenticated landing page. Stripe Checkout redirects the paying
 * customer here after success_url/cancel_url. Renders only from the `status`
 * query param — never calls the backend with paymentRequestId, since that ID
 * is a sequential integer and this route has no auth/tenant context to scope
 * a lookup safely.
 */
const PaymentResult: React.FC = () => {
  const { paymentRequestId } = useParams<{ paymentRequestId: string }>();
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">SPA Manager Pro</h1>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
          {isSuccess ? (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
              <h2 className="mt-4 text-xl font-bold text-gray-800">Pago recibido</h2>
              <p className="mt-2 text-sm text-gray-500">
                Tu pago fue procesado correctamente. Puedes cerrar esta ventana.
              </p>
            </>
          ) : (
            <>
              <XCircle className="mx-auto h-14 w-14 text-gray-400" />
              <h2 className="mt-4 text-xl font-bold text-gray-800">Pago no completado</h2>
              <p className="mt-2 text-sm text-gray-500">
                El proceso de pago fue cancelado o no se completó. Puedes intentarlo de
                nuevo desde el enlace que recibiste, o contactar al negocio.
              </p>
            </>
          )}
        </div>

        {paymentRequestId && (
          <div className="text-center mt-4 text-xs text-gray-400">
            Referencia: #{paymentRequestId}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentResult;
