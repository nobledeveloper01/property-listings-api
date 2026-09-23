import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Sensible security headers. Cheap, and the absence of them is the first
  // thing any review flags.
  app.use(helmet());
  app.enableCors({ origin: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip anything not on the DTO, and reject rather than ignore it. The
      // difference matters: silently dropping an unknown field lets a client
      // believe it set something it did not.
      whitelist: true,
      forbidNonWhitelisted: true,
      // Query strings are all strings; the DTOs declare real types and the
      // @Type decorators do the conversion.
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const swagger = new DocumentBuilder()
    .setTitle('Property Listings API')
    .setDescription(
      'Listings and geospatial search for a property marketplace. Distance search is ' +
        'index-backed via PostGIS ST_DWithin; see the README for why that matters.',
    )
    .setVersion('1.0')
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;

  await app.listen(port);
  Logger.log(`Listening on :${port} — docs at /docs`, 'Bootstrap');
}

void bootstrap();
