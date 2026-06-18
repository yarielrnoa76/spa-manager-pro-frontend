export interface SupportTicketPriority {
  id: number;
  tenant_id: number;
  name: string;
  color: string;
  sort_order: number;
}

export interface SupportTicketType {
  id: number;
  tenant_id: number;
  name: string;
  color: string;
  sort_order: number;
}

export interface SupportTicketComment {
  id: number;
  tenant_id: number;
  support_ticket_id: number;
  created_by: number;
  comment_type: 'public_comment' | 'internal_note';
  body: string;
  created_at: string;
  updated_at: string;
  attachments?: SupportTicketAttachment[];
  creator?: { id: number; name: string };
}

export interface SupportTicketAttachment {
  id: number;
  tenant_id: number;
  support_ticket_id?: number;
  support_ticket_comment_id?: number;
  file_name: string;
  file_path: string;
  file_mime_type: string;
  file_size: number;
  uploaded_by: number;
  created_at: string;
}

export interface SupportTicketLog {
  id: number;
  tenant_id: number;
  support_ticket_id: number;
  action: string;
  old_value?: any;
  new_value?: any;
  metadata?: any;
  performed_by: number;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  tenant_id: number;
  ticket_number: string;
  support_ticket_priority_id?: number;
  support_ticket_type_id?: number;
  status: 'new' | 'in_progress' | 'dismissed' | 'completed' | 'reopened';
  subject: string;
  ticket_body: string;
  assigned_to?: number;
  created_by?: number;
  updated_by?: number;
  deleted_by?: number;
  delete_reason?: string;
  disable_notifications: boolean;
  first_response_at?: string;
  completed_at?: string;
  time_to_first_response?: number;
  time_to_close?: number;
  resolution_time_minutes?: number;
  created_at: string;
  updated_at: string;

  priority?: SupportTicketPriority;
  type?: SupportTicketType;
  assignee?: { id: number; name: string };
  creator?: { id: number; name: string };
  updater?: { id: number; name: string };
  comments?: SupportTicketComment[];
  logs?: SupportTicketLog[];
  attachments?: SupportTicketAttachment[];
}
