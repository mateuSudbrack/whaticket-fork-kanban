export const FLOW_TRIGGER_TYPES = [
  "tag_added",
  "queue_entered",
  "user_transferred",
  "flow_sent"
] as const;

export const FLOW_ACTION_TYPES = [
  "edit_custom_field",
  "add_tag",
  "send_message",
  "send_photo",
  "transfer_queue",
  "transfer_user",
  "trigger_flow",
  "send_webhook",
  "wait",
  "random_delay",
  "move_main_kanban_stage",
  "move_pipeline_stage",
  "assign_pipeline",
  "add_contact_to_pipeline",
  "move_contact_pipeline_stage",
  "remove_contact_from_pipeline",
  "load_last_certificate_order_fields",
  "resolve_ticket",
  "stop_automations"
] as const;

export const FLOW_CONDITION_TYPES = [
  "custom_field_is",
  "user_is",
  "queue_is",
  "has_tag",
  "time_is",
  "weekday_is"
] as const;
