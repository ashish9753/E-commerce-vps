import client from './client';

export const settingsApi = {
  getCodSettings:    ()     => client.get('/settings/cod'),
  updateCodSettings: (data) => client.patch('/settings/cod', data),
};
