
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '../../generated/prisma/client.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

class TestController {}

function testHandler() {
  return undefined;
}

function createContext(role?: Role): ExecutionContext {
  const request = role
    ? { user: { role } }
    : {};

  return {
    getHandler: () => testHandler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let getAllAndOverride: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getAllAndOverride = vi.fn();

    const reflector = {
      getAllAndOverride,
    } as unknown as Reflector;

    guard = new RolesGuard(reflector);
  });

  it('permite acceder cuando no se requieren roles', () => {
    getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);

    expect(getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      [testHandler, TestController],
    );
  });

  it('permite acceder cuando la lista de roles está vacía', () => {
    getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('permite acceder a un ADMIN cuando se requiere ADMIN', () => {
    getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(guard.canActivate(createContext('ADMIN'))).toBe(true);
  });

  it('rechaza a un CUSTOMER cuando se requiere ADMIN', () => {
    getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() =>
      guard.canActivate(createContext('CUSTOMER')),
    ).toThrow(ForbiddenException);
  });

  it('rechaza a un CASHIER cuando se requiere ADMIN', () => {
    getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() =>
      guard.canActivate(createContext('CASHIER')),
    ).toThrow(ForbiddenException);
  });

  it('rechaza el acceso si no existe un usuario autenticado', () => {
    getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() =>
      guard.canActivate(createContext()),
    ).toThrow(ForbiddenException);
  });

  it('acepta cualquiera de los roles autorizados', () => {
    getAllAndOverride.mockReturnValue(['ADMIN', 'CASHIER']);

    expect(guard.canActivate(createContext('CASHIER'))).toBe(true);
  });
});
