import { createClient } from "@/lib/supabase/server";

export interface EventListItem {
  id: string;
  title: string;
  event_at: string;
  image_url: string | null;
  is_paid: boolean;
  ticket_price: number | null;
  capacity: number | null;
  business: { name: string; slug: string };
  ticket_count: number;
}

async function fetchUpcoming(untilIso?: string) {
  try {
    const supabase = createClient();

    let query = supabase
      .from("events")
      .select(
        `id, title, event_at, image_url, is_paid, ticket_price, capacity,
         business:businesses!inner(name, slug, approval_status),
         tickets(id, status)`
      )
      .eq("business.approval_status", "approved")
      .gte("event_at", new Date().toISOString())
      .order("event_at", { ascending: true });

    if (untilIso) query = query.lte("event_at", untilIso);

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row) => {
      const business = Array.isArray(row.business) ? row.business[0] : row.business;
      const tickets = (row.tickets ?? []) as { id: string; status: string }[];
      return {
        id: row.id,
        title: row.title,
        event_at: row.event_at,
        image_url: row.image_url,
        is_paid: row.is_paid,
        ticket_price: row.ticket_price,
        capacity: row.capacity,
        business,
        ticket_count: tickets.filter((t) => t.status === "active").length,
      };
    }) as EventListItem[];
  } catch {
    return [];
  }
}

export async function getUpcomingEventsThisWeek(): Promise<EventListItem[]> {
  const until = new Date();
  until.setDate(until.getDate() + 8);
  return fetchUpcoming(until.toISOString());
}

export async function getUpcomingEventsForHome(limit = 5): Promise<EventListItem[]> {
  const all = await fetchUpcoming();
  return all.slice(0, limit);
}

export interface PanelEvent {
  id: string;
  title: string;
  image_url: string | null;
  event_at: string;
  is_paid: boolean;
  ticket_price: number | null;
  capacity: number | null;
  is_cancelled: boolean;
  removed_by_admin: boolean;
  ticket_count: number;
}

export async function getMyEvents(businessId: string): Promise<PanelEvent[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, image_url, event_at, is_paid, ticket_price, capacity, is_cancelled, removed_by_admin, tickets(id, status)"
    )
    .eq("business_id", businessId)
    .order("event_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const tickets = (row.tickets ?? []) as { id: string; status: string }[];
    return {
      id: row.id,
      title: row.title,
      image_url: row.image_url,
      event_at: row.event_at,
      is_paid: row.is_paid,
      ticket_price: row.ticket_price,
      capacity: row.capacity,
      is_cancelled: row.is_cancelled,
      removed_by_admin: row.removed_by_admin,
      ticket_count: tickets.filter((t) => t.status !== "cancelled").length,
    };
  }) as PanelEvent[];
}

export interface EventParticipant {
  ticket_id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  status: string;
  price_paid: number | null;
  refund_status: string | null;
}

export interface PanelEventDetail extends PanelEvent {
  description: string | null;
  participants: EventParticipant[];
}

export async function getMyEventDetail(
  id: string,
  businessId: string
): Promise<PanelEventDetail | null> {
  const supabase = createClient();

  const { data: event, error } = await supabase
    .from("events")
    .select(
      "id, title, description, image_url, event_at, is_paid, ticket_price, capacity, is_cancelled, removed_by_admin, tickets(id, status)"
    )
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (error || !event) return null;

  const { data: participants } = await supabase.rpc("get_event_participants", {
    p_event_id: id,
  });

  const tickets = (event.tickets ?? []) as { id: string; status: string }[];

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    image_url: event.image_url,
    event_at: event.event_at,
    is_paid: event.is_paid,
    ticket_price: event.ticket_price,
    capacity: event.capacity,
    is_cancelled: event.is_cancelled,
    removed_by_admin: event.removed_by_admin,
    ticket_count: tickets.filter((t) => t.status !== "cancelled").length,
    participants: (participants ?? []).map((p: Record<string, unknown>) => ({
      ticket_id: p.ticket_id as string,
      full_name: p.full_name as string | null,
      phone: p.phone as string | null,
      created_at: p.created_at as string,
      status: p.status as string,
      price_paid: p.price_paid as number | null,
      refund_status: p.refund_status as string | null,
    })),
  };
}

export interface EventDetail extends EventListItem {
  description: string | null;
  business_district: string | null;
}

export interface MyTicket {
  id: string;
  qr_code: string;
  status: string;
  price_paid: number | null;
  refund_status: string | null;
  event: {
    title: string;
    event_at: string;
    is_cancelled: boolean;
    business: { name: string };
  };
}

export async function getMyTickets(userId: string): Promise<MyTicket[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("tickets")
      .select(
        `id, qr_code, status, price_paid, refund_status,
         event:events(title, event_at, is_cancelled, business:businesses(name))`
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data
      .filter((row) => row.qr_code)
      .map((row) => {
        const event = Array.isArray(row.event) ? row.event[0] : row.event;
        const business = Array.isArray(event?.business) ? event.business[0] : event?.business;
        return {
          id: row.id,
          qr_code: row.qr_code as string,
          status: row.status,
          price_paid: row.price_paid,
          refund_status: row.refund_status,
          event: {
            title: event?.title ?? "",
            event_at: event?.event_at ?? "",
            is_cancelled: event?.is_cancelled ?? false,
            business: { name: business?.name ?? "" },
          },
        };
      }) as MyTicket[];
  } catch {
    return [];
  }
}

export interface TicketWithQr {
  id: string;
  qr_code: string;
  event: { title: string; business: { name: string } };
}

export async function getTicketWithQr(ticketId: string): Promise<TicketWithQr | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("tickets")
      .select(`id, qr_code, event:events(title, business:businesses(name))`)
      .eq("id", ticketId)
      .single();

    if (error || !data || !data.qr_code) return null;

    const event = Array.isArray(data.event) ? data.event[0] : data.event;
    const business = Array.isArray(event?.business) ? event.business[0] : event?.business;

    return {
      id: data.id,
      qr_code: data.qr_code,
      event: { title: event?.title ?? "", business: { name: business?.name ?? "" } },
    };
  } catch {
    return null;
  }
}

export async function getEventDetail(id: string): Promise<EventDetail | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("events")
      .select(
        `id, title, description, event_at, image_url, is_paid, ticket_price, capacity,
         business:businesses!inner(name, slug, district, approval_status),
         tickets(id, status)`
      )
      .eq("id", id)
      .eq("business.approval_status", "approved")
      .single();

    if (error || !data) return null;

    const business = Array.isArray(data.business) ? data.business[0] : data.business;
    const tickets = (data.tickets ?? []) as { id: string; status: string }[];

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      event_at: data.event_at,
      image_url: data.image_url,
      is_paid: data.is_paid,
      ticket_price: data.ticket_price,
      capacity: data.capacity,
      business: { name: business.name, slug: business.slug },
      business_district: business.district,
      ticket_count: tickets.filter((t) => t.status === "active").length,
    };
  } catch {
    return null;
  }
}
