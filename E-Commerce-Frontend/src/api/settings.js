import client from './client';

export const settingsApi = {
  getCodSettings:         ()     => client.get('/settings/cod'),
  updateCodSettings:      (data) => client.patch('/settings/cod', data),
  getDeliverySettings:    ()     => client.get('/settings/delivery'),
  updateDeliverySettings: (data) => client.patch('/settings/delivery', data),
};
