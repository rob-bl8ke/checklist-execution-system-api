import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException, NotFoundException, ServiceUnavailableException, GatewayTimeoutException } from '@nestjs/common';
import request from 'supertest';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

const mockProviderStatus = {
  providers: [
    {
      providerKey: 'anthropic-api',
      available: true,
      transport: 'api',
      supportsChat: true,
      supportsPresetActions: true,
      supportsStructuredProposal: true,
      supportsStreaming: false,
      supportedModels: [],
    },
  ],
  defaultProviderKey: 'anthropic-api',
};

const mockSessionResponse = {
  session: {
    id: 1,
    targetType: 'NOTE',
    targetId: 10,
    providerKey: 'anthropic-api',
    model: null,
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: null,
    clearedAt: null,
  },
  messages: [],
  proposals: [],
  capabilitiesSummary: {
    providerKey: 'anthropic-api',
    available: true,
    transport: 'api',
    supportsChat: true,
    supportsPresetActions: true,
    supportsStructuredProposal: true,
    supportsStreaming: false,
  },
};

const mockInteractionResponse = {
  session: mockSessionResponse.session,
  assistantMessage: 'Here is some advice.',
  proposal: null,
  finishReason: 'STOP',
  capabilitiesSummary: mockSessionResponse.capabilitiesSummary,
};

describe('AiController', () => {
  let app: INestApplication;
  let aiService: jest.Mocked<AiService>;

  beforeEach(async () => {
    const mockAiService: Partial<jest.Mocked<AiService>> = {
      getProviderStatus: jest.fn().mockReturnValue(mockProviderStatus),
      getSession: jest.fn().mockResolvedValue(mockSessionResponse),
      clearSession: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue(mockInteractionResponse),
      runAction: jest.fn().mockResolvedValue(mockInteractionResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: mockAiService }],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    aiService = module.get(AiService);
  });

  afterEach(() => app.close());

  // ---------------------------------------------------------------------------
  // GET /api/ai/providers/status
  // ---------------------------------------------------------------------------

  describe('GET /api/ai/providers/status', () => {
    it('returns 200 with provider status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ai/providers/status')
        .expect(200);
      expect(res.body).toEqual(mockProviderStatus);
      expect(aiService.getProviderStatus).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/ai/targets/:targetType/:targetId/session
  // ---------------------------------------------------------------------------

  describe('GET /api/ai/targets/:targetType/:targetId/session', () => {
    it('returns 200 with session data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ai/targets/NOTE/10/session')
        .expect(200);
      expect(res.body).toEqual(mockSessionResponse);
      expect(aiService.getSession).toHaveBeenCalledWith('NOTE', 10);
    });

    it('returns 404 when target does not exist', async () => {
      aiService.getSession.mockRejectedValueOnce(new NotFoundException('Note 99 not found'));
      await request(app.getHttpServer())
        .get('/api/ai/targets/NOTE/99/session')
        .expect(404);
    });

    it('returns 400 for unsupported targetType', async () => {
      aiService.getSession.mockRejectedValueOnce(new BadRequestException("Unsupported target type: 'TEMPLATE'"));
      await request(app.getHttpServer())
        .get('/api/ai/targets/TEMPLATE/1/session')
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/ai/targets/:targetType/:targetId/session
  // ---------------------------------------------------------------------------

  describe('DELETE /api/ai/targets/:targetType/:targetId/session', () => {
    it('returns 204 on successful clear', async () => {
      await request(app.getHttpServer())
        .delete('/api/ai/targets/NOTE/10/session')
        .expect(204);
      expect(aiService.clearSession).toHaveBeenCalledWith('NOTE', 10);
    });

    it('returns 404 when note does not exist', async () => {
      aiService.clearSession.mockRejectedValueOnce(new NotFoundException('Note 99 not found'));
      await request(app.getHttpServer())
        .delete('/api/ai/targets/NOTE/99/session')
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/ai/targets/:targetType/:targetId/messages
  // ---------------------------------------------------------------------------

  describe('POST /api/ai/targets/:targetType/:targetId/messages', () => {
    it('returns 201 with interaction response', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/messages')
        .send({ message: 'Help me improve this note.' })
        .expect(201);
      expect(res.body).toEqual(mockInteractionResponse);
      expect(aiService.sendMessage).toHaveBeenCalledWith('NOTE', 10, expect.objectContaining({ message: 'Help me improve this note.' }));
    });

    it('returns 400 when message field is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/messages')
        .send({})
        .expect(400);
    });

    it('returns 400 for unsupported targetType', async () => {
      aiService.sendMessage.mockRejectedValueOnce(new BadRequestException("Unsupported target type: 'TEMPLATE'"));
      await request(app.getHttpServer())
        .post('/api/ai/targets/TEMPLATE/1/messages')
        .send({ message: 'test' })
        .expect(400);
    });

    it('returns 404 when note does not exist', async () => {
      aiService.sendMessage.mockRejectedValueOnce(new NotFoundException('Note 99 not found'));
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/99/messages')
        .send({ message: 'test' })
        .expect(404);
    });

    it('returns 503 when provider is unavailable', async () => {
      aiService.sendMessage.mockRejectedValueOnce(new ServiceUnavailableException('Provider unavailable'));
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/messages')
        .send({ message: 'test' })
        .expect(503);
    });

    it('returns 504 when provider times out', async () => {
      aiService.sendMessage.mockRejectedValueOnce(new GatewayTimeoutException('Provider timed out'));
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/messages')
        .send({ message: 'test' })
        .expect(504);
    });

    it('passes optional providerKey and model to service', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/messages')
        .send({ message: 'test', providerKey: 'openai-api', model: 'gpt-4o' })
        .expect(201);
      expect(aiService.sendMessage).toHaveBeenCalledWith('NOTE', 10, expect.objectContaining({ providerKey: 'openai-api', model: 'gpt-4o' }));
    });

    it('returns 400 for invalid providerKey enum value', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/messages')
        .send({ message: 'test', providerKey: 'invalid-provider' })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/ai/targets/:targetType/:targetId/actions/:actionKey
  // ---------------------------------------------------------------------------

  describe('POST /api/ai/targets/:targetType/:targetId/actions/:actionKey', () => {
    it('returns 201 with interaction response', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/actions/improve-note')
        .send({})
        .expect(201);
      expect(res.body).toEqual(mockInteractionResponse);
      expect(aiService.runAction).toHaveBeenCalledWith('NOTE', 10, 'improve-note', expect.any(Object));
    });

    it('returns 400 for unsupported actionKey', async () => {
      aiService.runAction.mockRejectedValueOnce(new BadRequestException("Unsupported action key: 'unknown-action'"));
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/actions/unknown-action')
        .send({})
        .expect(400);
    });

    it('returns 404 when note does not exist', async () => {
      aiService.runAction.mockRejectedValueOnce(new NotFoundException('Note 99 not found'));
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/99/actions/improve-note')
        .send({})
        .expect(404);
    });

    it('returns 503 when provider is unavailable', async () => {
      aiService.runAction.mockRejectedValueOnce(new ServiceUnavailableException('Provider unavailable'));
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/actions/improve-note')
        .send({})
        .expect(503);
    });

    it('returns 504 when provider times out', async () => {
      aiService.runAction.mockRejectedValueOnce(new GatewayTimeoutException('timed out'));
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/actions/improve-note')
        .send({})
        .expect(504);
    });

    it('accepts optional userInstruction', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/targets/NOTE/10/actions/review-code')
        .send({ userInstruction: 'Focus on security issues.' })
        .expect(201);
      expect(aiService.runAction).toHaveBeenCalledWith('NOTE', 10, 'review-code', expect.objectContaining({ userInstruction: 'Focus on security issues.' }));
    });
  });
});
