# Prompt Base Estruturado — Simulador de Partículas e Áudio 3D

## Objetivo Geral
Desenvolver uma aplicação web interativa que utiliza Three.js e Web Audio API para criar uma visualização 3D de partículas que reagem em tempo real à análise de frequência de um arquivo de áudio WAV. O sistema deve ser modular, extensível e permitir fácil evolução para fases futuras (física, interatividade, etc).

## Estrutura e Componentes Essenciais
- **Visualização 3D:** Cena Three.js com câmera orbital, cubo central, anel (torus) e partículas distribuídas em uma esfera.
- **Sistema de Partículas:** 400 partículas (ou mais), agrupadas por bandas de frequência, com cor, brilho e posição dinâmicas.
- **Áudio:** Carregamento de arquivos WAV, controles de play/pause/volume, visualização de waveform.
- **Análise de Frequência:** FFT (1024 amostras), convertida em 16 bandas logarítmicas especializadas.
- **Deformação Visual:** Cubo e anel vibram conforme a energia do áudio; partículas reagem às bandas.
- **Sistema de Rastros:** Rastros visuais para partículas, reforçando movimento e resposta ao áudio.
- **Controles Avançados:** Sliders para ADSR, intensidade por banda, suavização, sensibilidade a transientes, rastros, tipo de mapeamento de frequência.
- **Performance:** Otimizações para garantir 30-60fps (adaptive timestep, spatial partitioning, frustum culling, object pooling, throttling).

## Lógica de Funcionamento
1. Usuário carrega um arquivo WAV.
2. Áudio é processado e analisado em tempo real (FFT → 16 bandas).
3. Dados de frequência alimentam partículas, cubo e anel.
4. Interface permite ajustes finos em tempo real.
5. Visualização responde dinamicamente à música, diferenciando instrumentos e dinâmicas.

## Princípios para Evolução
- **Modularidade:** Cada fase (análise, visual, física, interatividade) deve ser implementada em módulos claros.
- **Extensibilidade:** O código deve ser comentado e estruturado para facilitar novas fases e recursos.
- **Performance:** Sempre monitorar FPS e otimizar para hardware modesto.
- **Interface Clara:** Controles intuitivos e responsivos para experimentação.

## Referências de Código
- `script.js`: Lógica principal, análise de áudio, partículas, deformação, rastros, controles.
- `index.html`: Interface e inclusão dos controles.
- `fase3_prompt.md`: Documentação detalhada das fases e requisitos.
- `relatorio_fase3.md`: Relatório detalhado do estado atual do projeto.

---

**Nota:** Este prompt base deve ser atualizado a cada nova fase, mantendo o contexto e os objetivos claros para qualquer desenvolvedor ou IA que venha a contribuir com o projeto.
