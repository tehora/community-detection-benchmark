setwd("")
m <- read.table("result-fixed.csv", sep=";", header=T)

100*sum(m$ari < m$base_ari)/nrow(m)
100*sum(m$ari == m$base_ari)/nrow(m)
100*sum(m$ari > m$base_ari)/nrow(m)

100*sum(m$nmi < m$base_nmi)/nrow(m)
100*sum(m$nmi == m$base_nmi)/nrow(m)
100*sum(m$nmi > m$base_nmi)/nrow(m)

100*sum(m$modularity < m$base_modularity)/nrow(m)
100*sum(m$modularity == m$base_modularity)/nrow(m)
100*sum(m$modularity > m$base_modularity)/nrow(m)

m$y_ari <- ifelse(m$ari >= m$base_ari, 1,0)
m$y_modularity <- ifelse(m$modularity >= m$base_modularity, 1,0)
m$y_nmi <- ifelse(m$nmi >= m$base_nmi, 1,0)
#m$count2 <- (m$seed_count_param)^2
#m$size2 <- (m$seed_size_param)^2
#m$avg2 <- (m$avg)^2

logit1 <- glm(y_ari ~ graph + algorithm + seed_count_param + I(seed_count_param^2) + seed_size_param + I(seed_size_param^2) + seed_structure_param + deg_median + deg_big +
                closeness_median + closeness_big + betweenness_median + betweenness_big + avg +I(avg^2), data=m, family=binomial)

logit2 <- glm(y_nmi ~ graph + algorithm + seed_count_param + I(seed_count_param^2) + seed_size_param + I(seed_size_param^2) + seed_structure_param + deg_median + deg_big +
                closeness_median + closeness_big + betweenness_median + betweenness_big + avg +I(avg^2), data=m, family=binomial)

logit3 <- glm(y_modularity ~ graph + algorithm + seed_count_param + I(seed_count_param^2) + seed_size_param + I(seed_size_param^2) + seed_structure_param + deg_median + deg_big +
                closeness_median + closeness_big + betweenness_median + betweenness_big + avg +I(avg^2), data=m, family=binomial)

# for odds ratios run, e.g.,
# exp(coefficients(logit1))

# vioplots for centralities
k <- read.table("karate_nodes.csv", sep=",", as.is=T, header=T)

library(data.table)
long <- melt(setDT(k), id.vars = c("Id"), variable.name = "centrality")
#X11()

library(ggplot2)

pdf("karate_centralities.pdf", 20,10)
pl <- ggplot(long, aes(x=as.factor(centrality), y=value)) +  #facet_wrap(~as.factor(centrality), scales="free") +
  xlab("") + ylab("Normalized centrality") + ggtitle("Zachary Karate club") + geom_violin() + geom_boxplot(width=0.05) +
  theme_minimal()
print(pl)
dev.off()

d <- read.table("dolphins_nodes.csv", sep=",", as.is=T, header=T)

library(data.table)
long <- melt(setDT(d), id.vars = c("Id"), variable.name = "centrality")
#X11()

library(ggplot2)

pdf("dolphins_centralities.pdf", 20,10)
pl <- ggplot(long, aes(x=as.factor(centrality), y=value)) +  #facet_wrap(~as.factor(centrality), scales="free") +
  xlab("") + ylab("Normalized centrality") + ggtitle("Dolphins") + geom_violin() + geom_boxplot(width=0.05) +
  theme_minimal()
print(pl)
dev.off()

f <- read.table("football_nodes.csv", sep=",", as.is=T, header=T)

library(data.table)
long <- melt(setDT(f), id.vars = c("Id"), variable.name = "centrality")
#X11()

library(ggplot2)

pdf("football_centralities.pdf", 20,10)
pl <- ggplot(long, aes(x=as.factor(centrality), y=value)) +  #facet_wrap(~as.factor(centrality), scales="free") +
  xlab("") + ylab("Normalized centrality") + ggtitle("Football") + geom_violin() + geom_boxplot(width=0.05) +
  theme_minimal()
print(pl)
dev.off()

pol <- read.table("polbooks_nodes.csv", sep=",", as.is=T, header=T)

library(data.table)
long <- melt(setDT(pol), id.vars = c("Id"), variable.name = "centrality")
#X11()

library(ggplot2)

pdf("polbooks_centralities.pdf", 20,10)
pl <- ggplot(long, aes(x=as.factor(centrality), y=value)) +  #facet_wrap(~as.factor(centrality), scales="free") +
  xlab("") + ylab("Normalized centrality") + ggtitle("Polbooks") + geom_violin() + geom_boxplot(width=0.05) +
  theme_minimal()
print(pl)
dev.off()



