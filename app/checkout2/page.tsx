"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";

import Header from "../components/header";
import LogoSection from "../components/LogoSection";
import MobileTopBar from "../components/HomePageTop";
import Footer from "../components/Footer";
import { API_BASE_URL } from "../utils/api";
import { ChatBot } from "../components/ChatBot";

type ProductTuple = [string, string, string, number, string]; // [rowId, name, image, unitPrice, desc]

// 🔐 Inject X-Frontend-Key on every request
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const fetchWithKey = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return fetch(url, { ...init, headers });
};

type HumanAttr = {
  attribute_id?: string;
  option_id?: string;
  attribute_name: string;
  option_label: string;
  price_delta: string; // "0.00" from backend
};

export default function PaymentCheckoutPage() {
  const router = useRouter();

  const [cartData, setCartData] = useState<{ products: ProductTuple[] }>({
    products: [],
  });
  const [loading, setLoading] = useState(true);

  // quantity and price keyed by our internal row id (cart_item_id if present, else product_id|signature)
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});

  // extra metadata we’ll pass to the order payload (not shown in UI)
  const [cartMeta, setCartMeta] = useState<
    Record<
      string,
      {
        cart_item_id?: string;
        product_id: string; // real product id for backend
        selected_size?: string;
        selected_attributes?: Record<string, string>;
        selected_attributes_human?: HumanAttr[];
        variant_signature?: string;
        attributes_price_delta?: number;
        base_price?: number;
        line_total?: number;
      }
    >
  >({});

  const [discountCode, setDiscountCode] = useState("");
  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    city: "",
    zip: "",
    instructions: "",
  });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("cart_user_id");
    if (storedToken) setToken(storedToken);
  }, []);

  useEffect(() => {
    const deviceUUID = localStorage.getItem("cart_user_id");
    if (!deviceUUID) {
      console.warn("❌ No device UUID found in localStorage.");
      setLoading(false);
      return;
    }

    const fetchCart = async () => {
      try {
        setLoading(true);

        const res = await fetchWithKey(`${API_BASE_URL}/api/show-cart/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-UUID": deviceUUID,
          },
          body: JSON.stringify({ device_uuid: deviceUUID }),
          cache: "no-store",
        });

        const data = await res.json();
        const items = data?.cart_items || [];

        const q: Record<string, number> = {};
        const p: Record<string, number> = {};
        const prod: ProductTuple[] = [];
        const meta: typeof cartMeta = {};

        for (const item of items) {
          const cartItemId = item.cart_item_id;
          const productId = item.product_id;
          const signature = item.variant_signature || "";

          // Robust unique row id
          const rowId: string =
            cartItemId || `${productId}${signature ? `|${signature}` : ""}`;

          const unitPriceStr =
            item?.price_breakdown?.unit_price ??
            item?.unit_price ??
            item?.product_price ??
            "0";
          const unitPriceNum = parseFloat(unitPriceStr) || 0;

          // Merge human-readable selections for the small line under product name
          const size = (item.selected_size || "").toString().trim();
          const human: HumanAttr[] = Array.isArray(
            item.selected_attributes_human
          )
            ? item.selected_attributes_human
            : [];
          const selectionParts: string[] = [];
          if (size) selectionParts.push(`Size: ${size}`);
          human.forEach((d) =>
            selectionParts.push(`${d.attribute_name}: ${d.option_label}`)
          );
          const selectionDesc = selectionParts.join(" • ");

          // Fill UI lists
          q[rowId] = item.quantity || 1;
          p[rowId] = unitPriceNum;
          prod.push([
            rowId,
            item.product_name,
            item.product_image || "/images/default.jpg",
            unitPriceNum,
            selectionDesc, // show clean selections under name
          ]);

          // Stash metadata used later, including base & deltas for WhatsApp message
          const basePriceNum =
            parseFloat(item?.price_breakdown?.base_price ?? "0") || 0;
          const lineTotalNum =
            parseFloat(item?.price_breakdown?.line_total ?? "0") || 0;
          const attrsDeltaNum =
            parseFloat(
              item?.price_breakdown?.attributes_delta ??
                item?.attributes_price_delta ??
                "0"
            ) || 0;

          meta[rowId] = {
            cart_item_id: cartItemId,
            product_id: productId,
            selected_size: size,
            selected_attributes: item.selected_attributes || {},
            selected_attributes_human: human,
            variant_signature: signature,
            attributes_price_delta: attrsDeltaNum,
            base_price: basePriceNum,
            line_total: lineTotalNum,
          };
        }

        setQuantities(q);
        setCustomPrices(p);
        setCartData({ products: prod });
        setCartMeta(meta);
      } catch (err) {
        console.error("❌ Cart fetch error:", err);
        setCartData({ products: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchCart();
  }, []);

  const subtotal = cartData.products.reduce(
    (acc, [rowId]) =>
      acc + (quantities[rowId] || 1) * (customPrices[rowId] || 0),
    0
  );
  const tax = 50;
  const shipping = 100;
  const total = subtotal + tax + shipping;

  const updateQuantity = (rowId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [rowId]: Math.max(1, (prev[rowId] || 1) + delta),
    }));
  };

  const removeItem = async (rowId: string) => {
    const meta = cartMeta[rowId];
    const realProductId = meta?.product_id || rowId;

    // Optimistic UI updates
    setQuantities((prev) => {
      const copy = { ...prev };
      delete copy[rowId];
      return copy;
    });

    setCustomPrices((prev) => {
      const copy = { ...prev };
      delete copy[rowId];
      return copy;
    });

    setCartData((prev) => ({
      ...prev,
      products: prev.products.filter(([rid]) => rid !== rowId),
    }));

    try {
      // Use variant_signature for precise deletion of this variant line
      const res = await fetchWithKey(`${API_BASE_URL}/api/delete-cart-item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: token, // kept for compatibility
          product_id: realProductId,
          variant_signature: meta?.variant_signature || "",
        }),
      });

      if (!res.ok) throw new Error();

      Toastify({
        text: "Product removed from cart successfully",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "linear-gradient(to right, #af4c4cff, #d30000ff)",
      }).showToast();
    } catch {
      Toastify({
        text: "Failed to remove product from cart",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#d32f2f",
      }).showToast();
    }
  };

  const handleOrderNow = async () => {
    // Build WhatsApp message with exact math format:
    // Product (Paper Type: Simple, Size: 49): 3 x $(4 + 0 + 5) = $27
    let msgLines: string[] = [
      `Name: ${userInfo.name || "N/A"}`,
      `Email: ${userInfo.email || "N/A"}`,
      `Phone: ${userInfo.phone || "N/A"}`,
      `Company: ${userInfo.company || "N/A"}`,
      `Address: ${userInfo.address || "N/A"}`,
      `City: ${userInfo.city || "N/A"}`,
      `Zip: ${userInfo.zip || "N/A"}`,
      `Instructions: ${userInfo.instructions || "N/A"}`,
      ``,
      `Order:`,
    ];

    // Basic validation for delivery
    if (
      !userInfo.email ||
      !userInfo.address ||
      !userInfo.city ||
      !userInfo.phone
    ) {
      Toastify({
        text: "Please fill in all required delivery fields",
        duration: 3000,
        backgroundColor: "#d32f2f",
      }).showToast();
      return;
    }

    const itemsForBackend: any[] = [];

    for (const [rowId, name] of cartData.products.map(
      ([rid, n]) => [rid, n] as const
    )) {
      const qty = quantities[rowId] || 1;
      const unitPrice = customPrices[rowId] || 0;
      const meta = cartMeta[rowId]; // no {} fallback — keeps typing intact
      const realProductId = meta?.product_id || rowId;

      // Human-readable pieces for message
      const size = meta?.selected_size?.trim()
        ? `Size: ${meta.selected_size.trim()}`
        : "";
      const humanRaw = meta?.selected_attributes_human;
      const human: HumanAttr[] = Array.isArray(humanRaw) ? humanRaw : [];

      const selectionTokens: string[] = [];
      if (size) selectionTokens.push(size);
      human.forEach((d) =>
        selectionTokens.push(`${d.attribute_name}: ${d.option_label}`)
      );
      const selectionParen = selectionTokens.length
        ? ` (${selectionTokens.join(", ")})`
        : "";

      // Price math parts: base + ALL deltas (including zeros)
      const base = meta?.base_price ?? unitPrice; // fallback if not sent
      const deltas = (meta?.selected_attributes_human ?? []).map(
        (d) => d.price_delta || "0"
      );
      const mathParts = [base.toString(), ...deltas].join(" + ");
      const lineTotal = (unitPrice * qty).toFixed(2);

      msgLines.push(
        `${name}${selectionParen}: ${qty} x $(${mathParts}) = $${lineTotal}`
      );

      // Backend payload item — includes human list + base_price
      itemsForBackend.push({
        product_id: realProductId,
        quantity: parseInt(qty.toString()),
        unit_price: Number(unitPrice.toFixed(2)),
        total_price: Number((unitPrice * qty).toFixed(2)),

        selected_size: meta?.selected_size || "",
        selected_attributes: meta?.selected_attributes || {},
        selected_attributes_human: human,
        base_price: meta?.base_price, // if undefined, omit
        variant_signature: meta?.variant_signature || "",
        attributes_price_delta: meta?.attributes_price_delta ?? 0,
      });
    }

    msgLines.push(
      ``,
      `Subtotal: $${subtotal.toFixed(2)}`,
      `Tax: $${tax}`,
      `Shipping: $${shipping}`,
      `Total: $${total.toFixed(2)}`
    );

    const payload = {
      user_name: userInfo.name || "Guest",
      total_price: total.toFixed(2),
      status: "pending",
      notes: "Order from checkout page",
      items: itemsForBackend,
      delivery: {
        name: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone,
        street_address: userInfo.address,
        city: userInfo.city,
        zip_code: userInfo.zip,
        instructions: userInfo.instructions?.trim()
          ? [userInfo.instructions.trim()]
          : [],
      },
    };

    try {
      const res = await fetchWithKey(`${API_BASE_URL}/api/save-order/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      Toastify({
        text: "Order successfully placed!",
        duration: 3000,
        backgroundColor: "#c41717ff",
      }).showToast();

      // Clear Cart on frontend & backend
      for (const [rowId] of cartData.products) {
        const meta = cartMeta[rowId];
        const realProductId = meta?.product_id || rowId;
        try {
          await fetchWithKey(`${API_BASE_URL}/api/delete-cart-item/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: token,
              product_id: realProductId,
              variant_signature: meta?.variant_signature || "",
            }),
          });
        } catch (err) {
          console.warn(`❌ Failed to delete item ${rowId} after order:`, err);
        }
      }

      setCartData({ products: [] });
      setQuantities({});
      setCustomPrices({});

      // WhatsApp message with the detailed breakdown format
      const msg = msgLines.join("\n");
      window.open(
        `https://wa.me/923423773564?text=${encodeURIComponent(msg)}`,
        "_blank"
      );
    } catch (err) {
      console.error("❌ Order save failed:", err);
      Toastify({
        text: "Failed to place order",
        duration: 3000,
        backgroundColor: "#d32f2f",
      }).showToast();
    }
  };

  const orderItems = cartData.products.map(
    ([rowId, name, pic, unitPrice, desc]) => ({
      id: rowId,
      name,
      pic: pic || "images/img1.jpg",
      desc: desc || "",
      quantity: quantities[rowId] || 1,
      price: customPrices[rowId] || unitPrice || 0,
    })
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-gray-600">
        Loading your cart...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black text-[3.5vw] sm:text-base">
      <Header />
      <LogoSection />
      <MobileTopBar />

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Delivery Section */}
        <div className="bg-white shadow rounded-lg p-8">
          <h2 className="text-2xl font-semibold mb-6 text-black">
            Delivery Address
          </h2>
          <div className="space-y-4 text-black">
            {[
              { label: "Full Name", key: "name" },
              { label: "Email Address", key: "email" },
              { label: "Phone", key: "phone" },
              { label: "Company", key: "company" },
              { label: "Street Address", key: "address" },
              { label: "City", key: "city" },
              { label: "Zip", key: "zip" },
              { label: "Instructions", key: "instructions" },
            ].map(({ label, key }) => (
              <div
                key={key}
                className={
                  ["phone", "company", "city", "zip", "instructions"].includes(
                    key
                  )
                    ? "w-full sm:w-1/2"
                    : ""
                }
              >
                <label className="text-sm font-medium">{label}</label>
                <input
                  type="text"
                  onChange={(e) =>
                    setUserInfo((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-gray-50"
                  inputMode={
                    key === "zip" || key === "phone" ? "numeric" : "text"
                  }
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleOrderNow}
            disabled={cartData.products.length === 0}
            className={`w-full mt-8 py-3 text-sm font-medium rounded-md transition-all
              ${
                cartData.products.length === 0
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-[#891F1A] text-white hover:bg-[#6e1815]"
              }`}
          >
            Order Now
          </button>
        </div>

        {/* Order Summary */}
        <div className="bg-white shadow rounded-lg p-8">
          <h3 className="text-2xl font-semibold mb-6 text-black">Order</h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {orderItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap sm:flex-nowrap items-center justify-between border p-3 rounded-md bg-gray-50 text-black"
              >
                <img
                  src={item.pic || "/images/default.jpg"}
                  alt={item.name}
                  width={56}
                  height={56}
                  loading="lazy"
                  className="w-14 h-14 object-cover rounded flex-shrink-0"
                  onError={(e) => (e.currentTarget.src = "/images/img1.jpg")}
                />
                <div className="flex-1 ml-4 text-sm min-w-[160px]">
                  <p className="font-medium line-clamp-1">{item.name}</p>
                  {/* show human selections under product name */}
                  {item.desc ? (
                    <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
                  ) : null}
                </div>
                <div className="flex items-center space-x-1 my-2 sm:my-0">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="border w-8 h-8 flex items-center justify-center rounded"
                  >
                    <Minus size={15} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="border w-8 h-8 flex items-center justify-center rounded"
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <div className="flex flex-col items-end ml-4 space-y-1">
                  {/* You can show price if needed:
                  <span className="text-sm font-medium">${(item.price * item.quantity).toFixed(2)}</span> */}
                  <button onClick={() => removeItem(item.id)}>
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Discount */}
          <div className="mt-6">
            <label className="text-sm font-medium text-black mb-1 block">
              Discount Code
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-md"
              />
              <button
                onClick={() =>
                  Toastify({
                    text: "Invalid discount code",
                    duration: 3000,
                    backgroundColor: "#d32f2f",
                  }).showToast()
                }
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-6 border-t pt-4 space-y-2 text-black">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax</span>
              <span>${tax}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Shipping</span>
              <span>${shipping}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <Footer />
      <ChatBot />
    </div>
  );
}
