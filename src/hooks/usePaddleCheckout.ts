import { useEffect, useCallback, useRef } from "react";

declare global {
  interface Window {
    Paddle?: any;
  }
}

const PADDLE_CLIENT_TOKEN = "live_2585f1ec2188b20237cb9ac7b8a";

let paddleInitialized = false;
let paddleLoading = false;
const initCallbacks: (() => void)[] = [];

function loadPaddleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Paddle) {
      resolve();
      return;
    }

    if (paddleLoading) {
      initCallbacks.push(() => resolve());
      return;
    }

    paddleLoading = true;
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = () => {
      paddleLoading = false;
      resolve();
      initCallbacks.forEach((cb) => cb());
      initCallbacks.length = 0;
    };
    script.onerror = () => {
      paddleLoading = false;
      reject(new Error("Failed to load Paddle.js"));
    };
    document.head.appendChild(script);
  });
}

interface PaddleCheckoutOptions {
  priceId: string;
  customerEmail?: string;
  customData?: Record<string, string>;
  onSuccess?: () => void;
}

export function usePaddleCheckout() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    loadPaddleScript().then(() => {
      if (!paddleInitialized && window.Paddle) {
        window.Paddle.Initialize({
          token: PADDLE_CLIENT_TOKEN,
          environment: "sandbox",
        });
        paddleInitialized = true;
      }
    }).catch(console.error);
  }, []);

  const openCheckout = useCallback(({ priceId, customerEmail, customData, onSuccess }: PaddleCheckoutOptions) => {
    if (!window.Paddle) {
      console.error("Paddle.js not loaded yet");
      return;
    }

    const checkoutSettings: any = {
      items: [{ priceId, quantity: 1 }],
    };

    if (customerEmail) {
      checkoutSettings.customer = { email: customerEmail };
    }

    if (customData) {
      checkoutSettings.customData = customData;
    }

    if (onSuccess) {
      checkoutSettings.settings = {
        successCallback: onSuccess,
      };
    }

    window.Paddle.Checkout.open(checkoutSettings);
  }, []);

  return { openCheckout };
}
