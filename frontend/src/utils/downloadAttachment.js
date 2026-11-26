import { ticketsApi } from '../api/endpoints';

export async function downloadAttachment(ticketId, attachment) {
  const response = await ticketsApi.downloadAttachment(ticketId, attachment.id);
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = attachment.original_name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
