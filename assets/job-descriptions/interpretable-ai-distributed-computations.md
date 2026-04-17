# **Interpretable AI for unveiling distributed computations in the brain** 

**Advisors:** **Srdjan OSTOJIC (ENS \- PSL)**, **Joao BARBOSA (Inserm)**  
**Framework:** This PhD thesis will be conducted within the **PR\[AI\]RIE-PSAI research program**.

# **Context and Motivation for the Project**

The central objective of this PhD is to develop interpretable artificial intelligence methods for uncovering the principles of distributed computations in biological neural systems. A central question in neuroscience is how cognition emerges from the coordinated activity of large populations of neurons distributed across multiple brain regions. Recent advances in electrophysiology now make it possible to record simultaneously from hundreds to thousands of neurons across cortical and subcortical areas while animals perform complex cognitive tasks. These recordings (Steinmetz et al., 2019; International Brain Laboratory, 2025\) have revealed that many task-relevant variables—such as sensory evidence, choice or feedback—can often be decoded from many brain regions. This has led to the influential view that cognition is fundamentally distributed across the brain. However, an important conceptual question remains unresolved: **does distributed representation imply distributed computation?** In other words, if similar information is present across many regions, does this mean that computations are uniformly spread across the brain, or do distinct regions still carry out specific computations?


Answering this question requires going beyond standard encoding/decoding approaches. It requires methods that can move from high-dimensional neural recordings to **mechanistic hypotheses** about the computations performed by distributed circuits. Recent developments in artificial intelligence  provide new avenues in this direction (Durstewitz et al., 2023). In particular, recurrent neural networks (RNNs) are becoming a central model in neuroscience as individual units can be mapped onto individual neurons in the brain. RNNs can capture complex temporal computations and can be directly trained on large scale recordings. This offers a promising approach to build models of otherwise hard to interpret large-scale, multi-modal brain data. Yet standard RNNs are often too complex to interpret mechanistically (Sussillo & Barak, 2013). This project will develop interpretable neural network models as mechanistic tools to reverse-engineer the dynamical principles underlying distributed neural processes. Specifically, this project will leverage  low-rank RNNs, an emergent class of neural networks that are analytically tractable while remaining highly expressive. 


Over the past years, our respective groups have developed complementary approaches in this arena. SO group has pioneered theoretical frameworks for interpretable recurrent neural networks, in particular low-rank RNNs, which provide mathematically tractable models linking connectivity, dynamics, and computation (Mastrogiuseppe & Ostojic, 2018; Beiran et al. 2021; Dubreuil et al. 2022; Beiran et al. 2023). JB group has developed approaches to analyze large-scale and multiregional neural recordings (Barbosa et al. 2020, Tschiersch et al. 2025\) and to use deep learning techniques to fit neurally constrained recurrent models directly to experimental data (Barbosa et. al, 2023, Barbosa et al. 2024), with applications to flexible cognition in rodents and non-human primates.


## **Objective 1 – Develop interpretable AI models to uncover distributed neural architectures**

The first objective is to develop a new class of interpretable multi-regional recurrent neural network models that can be directly constrained by large-scale neural recordings with single-trial predictive resolution. Rather than using artificial neural networks as black-box predictors, the goal is to construct interpretable models whose internal dynamics can be mapped onto neural population activity recorded across multiple brain regions.


A central methodological focus will be the use of low-rank recurrent neural networks (Mastrogiuseppe & Ostojic, 2018; Dubreuil et al. 2022; Beiran et al. 2022; Beiran et al. 2023; Barbosa et al. 2023). By constraining the neural network weights to be low-rank these models naturally account for low-dimensional dynamics observed in the brain (Perich et al., 2025\) and become analytically tractable (Mastrogiuseppe & Ostojic, 2018; Dubrueil et al., 2022; Beiran et al. 2022). In this objective, we will train low-rank RNN (Valente et al. 2022; Barbosa et al. 2024\) to reproduce large-scale, multi-modal recordings from the International Brain Laboratory (International Brain Laboratory, 2025; Noel et al. 2025\) and extract low-dimensional, mechanistic descriptions.


The expected outcome is a principled modeling framework capable of generating explicit and testable predictions at the single-trial level. Specifically, we will use our models to explore extensively the space of possible perturbations in silico.  


## **Objective 2 – Use the developed framework to characterize inter-individual differences in distributed neural computation**

The second objective is to leverage the developed framework to study inter-individual variability in cross-regional interactions. Using large-scale datasets from the International Brain Laboratory, which include recordings from 139 animals performing standardized tasks, the project will investigate whether differences in behavior and neural activity across individuals correspond to differences in the inferred neural architecture. These differences may manifest as changes in dynamics, effective dimensionality or inter-area coupling structure.


This objective will address whether different individuals solving the same task rely on a common computational strategy or on distinct implementations of distributed computation. 

## **Objective 3 – Test hypothesis: behavioral differences in rodent autism models are explained by differences in distributed neural computations**

The third objective is to extend this approach to investigate how distributed neural architectures are altered in rodent models of autism spectrum disorder (ASD). Recent efforts within the International Brain Laboratory and related collaborations aim to generate large-scale neural recordings in animal models relevant to neurodevelopmental disorders, providing a unique opportunity to study altered computation at the circuit level (Noel et al., 2025). This dataset has the same format and API as Objective 2, making this milestone accessible if the previous one is achieved.


The central hypothesis is that ASD-related phenotypes may correspond to **specific changes in the dynamical organization of neural activity**, such reduced flexibility of state transitions, or differences in how computations are distributed across brain regions, as quantified in Objective 2\.

# **Candidate Profile**

We are looking for a highly motivated candidate with a strong background in at least one of the following fields: **machine learning, computer science, computational neuroscience, physics or applied mathematics.**


Prior experience in one or more of the following would be particularly valuable:

* machine learning or deep learning  
* scientific programming (Python, PyTorch, JAX, or equivalent)  
* neural data analysis  
* dynamical systems or recurrent neural networks


A strong quantitative background, scientific curiosity, and interest in interdisciplinary research are essential.


# **Statement**

**Non-discrimination, openness and transparency.** All PR\[AI\]RIE-PSAI partners are committed to supporting and promoting equality, diversity, and inclusion within their communities. We encourage applications from diverse backgrounds, which we will ensure to select through an open and transparent recruitment process.


# **References**

Steinmetz, N. et al. *Distributed coding of choice, action and engagement across the mouse brain* **Nature** (2019).

International Brain Laboratory *A brain-wide map of neural activity during complex behaviour* **Nature** (2025).

Durstewitz, D. et al. *Reconstructing computational system dynamics from neural data with recurrent neural networks* **Nature Reviews Neuroscience** (2023).

Sussillo D. and Barak O. *Opening the black box: low-dimensional dynamics in high-dimensional recurrent neural networks* **Neural Computation** (2013).

Mastrogiuseppe, F. and Ostojic, S. *Linking connectivity, dynamics, and computations in low-rank recurrent neural networks.* **Neuron** (2018).

Beiran, M. et al. *Shaping dynamics with multiple populations in low-rank recurrent networks.* **Neural Computation** (2021).

Dubreuil, A. et al. *The role of population structure in computations through neural dynamics* **Nature Neuroscience** (2022).

Beiran, M. et al. *Parametric control of flexible timing through low-dimensional neural manifolds* **Neuron** (2023).

Barbosa, J. et al. *Interplay between persistent activity and activity-silent dynamics in the prefrontal cortex underlies serial biases in working memory.* **Nature Neuroscience** (2020).

Tschiersch, M. et al. *Redundant, weakly connected prefrontal hemispheres balance precision and capacity in spatial working memory* **bioRxiv** (2025).

Barbosa, J. et al. *Early selection of task-relevant features through population gating* **Nature Communications** (2023).

Barbosa, J. et al. *Estimating flexible across-area communication with neurally-constrained RNN* **Cognitive Computational Neuroscience** (2024).

Perich, M. et al. *A neural manifold view of the brain* **Nature Neuroscience** (2025).

Valente, A., Pillow, J., and Ostojic, S. *Extracting interpretable dynamics from trained recurrent neural networks.* **NeurIPS** (2022).

Noel, JP. et al. *A common computational and neural anomaly across mouse models of autism **Nature Neuroscience*** (2025).