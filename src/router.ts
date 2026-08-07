// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `/`
  | `/academic-calendar`
  | `/contact`
  | `/dashboard`
  | `/dashboard/academic-calendar`
  | `/dashboard/attendance`
  | `/dashboard/attendance/:classId`
  | `/dashboard/contact`
  | `/dashboard/courses`
  | `/dashboard/curriculum`
  | `/dashboard/curriculum/:categoryId`
  | `/dashboard/exams`
  | `/dashboard/grades`
  | `/dashboard/hod-dean`
  | `/dashboard/marks`
  | `/dashboard/payment-receipts`
  | `/dashboard/profile`
  | `/dashboard/settings`
  | `/dashboard/timetable`
  | `/debug`
  | `/legal`

export type Params = {
  '/dashboard/attendance/:classId': { classId: string }
  '/dashboard/curriculum/:categoryId': { categoryId: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
