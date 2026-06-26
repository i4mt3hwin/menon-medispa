// Google tag gateway path for the GTM container (GTM-MSMM2PHT).
//
// This folder name ("m7q3") IS the reserved measurement path. It must match the
// path you register in the Google tag / GTM gateway admin. Pick anything unused
// and opaque (avoid words blockers match like "gtm"/"analytics"/"collect"); if
// you change it here, rename the folder AND update the admin + the snippet.
//
// The fps.goog origin Google issues for this container goes in the Pages env var
// GTM_GATEWAY_ORIGIN (e.g. "gtm-ab12cd34.fps.goog"). See CLAUDE.md.
//
// To also route the standalone GA4 tag (G-Q7BGS5BFLM) first-party, copy this
// folder to a second path and point it at a GA4_GATEWAY_ORIGIN var.

import { gateway } from "../_gateway.js";

export const onRequest = gateway("GTM_GATEWAY_ORIGIN");
