import { createContext, useContext } from 'react';
import { ordersApi } from '../api/orders';
import { getErrorMessage } from '../api/client';

const OrderContext = createContext(null);

export function OrderProvider({ children }) {
  const placeOrder = async (orderData) => {
    try {
      const { data } = await ordersApi.place(orderData);
      return { success: true, order: data.data.order };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  const getMyOrders = async (params) => {
    try {
      const { data } = await ordersApi.getMy(params);
      return { success: true, ...data.data };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  const getOrderById = async (id) => {
    try {
      const { data } = await ordersApi.getById(id);
      return { success: true, order: data.data.order };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  const cancelOrder = async (id, data = {}) => {
    try {
      const { data: res } = await ordersApi.cancel(id, data);
      return { success: true, order: res.data.order };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  };

  return (
    <OrderContext.Provider value={{ placeOrder, getMyOrders, getOrderById, cancelOrder }}>
      {children}
    </OrderContext.Provider>
  );
}

export const useOrders = () => useContext(OrderContext);
