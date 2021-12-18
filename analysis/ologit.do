// wczytac dane result-fixed.csv
// sep == ;

gen y_ari = 1
replace y_ari = 2 if ari == base_ari
replace y_ari = 3 if ari > base_ari

gen y_nmi = 1
replace y_nmi = 2 if nmi == base_nmi
replace y_nmi = 3 if nmi > base_nmi

gen y_mod = 1
replace y_mod = 2 if modularity == base_modularity
replace y_mod = 3 if modularity > base_modularity

gen count2 = seed_count_param^2
gen size2 = seed_size_param^2
gen avg2 = avg^2

label define hierarchy 1 "Less" 2 "Equal" 3 "More"
label value y_ari hierarchy
label value y_nmi hierarchy
label value y_mod hierarchy

gen struct = 0
replace struct = 1 if seed_structure_param == "CONNECTED"

gen graph1 = 0
replace graph1 =1 if graph =="dolphins"
replace graph1 =2 if graph =="football"
replace graph1 =3 if graph =="polbooks"

gen algo = 0
replace algo =1 if algorithm == "edgeBetweennessSeed "
replace algo =2 if algorithm == "louvainSeed"

xi:ologit y_ari i.graph1 i.algo seed_count_param seed_size_param i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg

xi:ologit y_ari i.graph1 i.algo seed_count_param seed_size_param i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg, or

fitstat
linktest
brant, detail

xi:ologit y_ari i.graph1 i.algo seed_count_param count2 seed_size_param size2 i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg avg2

xi:ologit y_ari i.graph1 i.algo seed_count_param count2 seed_size_param size2 i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg avg2, or

fitstat
linktest
brant, detail

xi:ologit y_nmi i.graph1 i.algo seed_count_param seed_size_param i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg

xi:ologit y_nmi i.graph1 i.algo seed_count_param seed_size_param i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg, or

fitstat
linktest
brant, detail

xi:ologit y_nmi i.graph1 i.algo seed_count_param count2 seed_size_param size2 i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg avg2

xi:ologit y_nmi i.graph1 i.algo seed_count_param count2 seed_size_param size2 i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg avg2, or

fitstat
linktest
brant, detail

xi:ologit y_mod i.graph1 i.algo seed_count_param seed_size_param i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg

xi:ologit y_mod i.graph1 i.algo seed_count_param seed_size_param i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg, or

fitstat
linktest
brant, detail

xi:ologit y_mod i.graph1 i.algo seed_count_param count2 seed_size_param size2 i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg avg2

xi:ologit y_mod i.graph1 i.algo seed_count_param count2 seed_size_param size2 i.struct deg_median i.deg_big closeness_median i.closeness_big betweenness_median i.betweenness_big avg avg2, or

fitstat
linktest
brant, detail


