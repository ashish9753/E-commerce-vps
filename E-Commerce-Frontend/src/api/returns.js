import client from './client';

export const returnsApi = {
  // Customer
  submit:            (data)     => client.post('/returns', data),
  getMy:             ()         => client.get('/returns/my'),
  getRefundDetails:  ()         => client.get('/returns/refund-details'),
  getById:           (id)       => client.get(`/returns/${id}`),
  updateRefundMethod:(id, data) => client.patch(`/returns/${id}/refund-method`, data),

  // Employee
  getEmployeeReturns: (params)  => client.get('/returns/employee', { params }),
  employeeAction:     (id, data) => client.patch(`/returns/${id}/employee-action`, data),
  // data: { note?, files?: FileList } — files uploaded as refund proof
  employeeAdvance: (id, { note, files } = {}) => {
    const form = new FormData();
    if (note) form.append('note', note);
    if (files) [...files].forEach(f => form.append('refundProof', f));
    return client.patch(`/returns/${id}/employee-advance`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Admin — data: { status, adminNote?, refundAmount?, files?: FileList }
  getAll:   (params) => client.get('/returns', { params }),
  process: (id, { status, adminNote, refundAmount, files } = {}) => {
    const form = new FormData();
    form.append('status', status);
    if (adminNote)    form.append('adminNote', adminNote);
    if (refundAmount !== undefined) form.append('refundAmount', refundAmount);
    if (files) [...files].forEach(f => form.append('refundProof', f));
    return client.patch(`/returns/${id}/process`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
